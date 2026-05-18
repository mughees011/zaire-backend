"""
ZAIRE System Health Monitor — Tier 2 Brain Upgrade (#8)
Flask sidecar on port 3009.

Provides real-time CPU, RAM, Disk, GPU, Network metrics
for the ZAIRE HUD. Designed to be polled by the frontend
every 2-3 seconds for a live dashboard.

Also maintains a rolling 60-second history of each metric
so the HUD can draw mini sparkline graphs.

Install: pip install psutil flask flask-cors GPUtil
"""

import os
import sys
import time
import psutil
import json
import threading
from datetime import datetime
from collections import deque

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError as e:
    print(f"[HEALTH] Missing: {e}")
    print("Run: pip install psutil flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Config ──────────────────────────────────────────────────────────────────
HISTORY_LEN    = 60      # number of data points to keep in history
SAMPLE_RATE    = 2       # seconds between background samples

# ─── Rolling History Buffers ─────────────────────────────────────────────────
cpu_history:  deque[float] = deque(maxlen=HISTORY_LEN)
ram_history:  deque[float] = deque(maxlen=HISTORY_LEN)
disk_history: deque[float] = deque(maxlen=HISTORY_LEN)
gpu_history:  deque[float] = deque(maxlen=HISTORY_LEN)
net_history:  deque[dict]  = deque(maxlen=HISTORY_LEN)

last_net_io = psutil.net_io_counters()
last_net_time = time.time()

sampler_active = False
sampler_thread = None

# ─── GPU Support ──────────────────────────────────────────────────────────────

def _get_gpu_stats() -> list[dict]:
    try:
        import GPUtil
        gpus = []
        for g in GPUtil.getGPUs():
            gpus.append({
                "id":           g.id,
                "name":         g.name,
                "load_percent": round(g.load * 100, 1),
                "mem_used_mb":  round(g.memoryUsed, 0),
                "mem_total_mb": round(g.memoryTotal, 0),
                "mem_percent":  round(g.memoryUtil * 100, 1),
                "temp_c":       round(g.temperature, 1),
                "driver":       g.driver
            })
        return gpus
    except ImportError:
        return []
    except Exception as e:
        return []


# ─── Core Snapshot ────────────────────────────────────────────────────────────

def _snapshot() -> dict:
    global last_net_io, last_net_time

    # CPU (per-core optional)
    cpu_pct     = psutil.cpu_percent(interval=0.2)
    cpu_freq    = psutil.cpu_freq()
    cpu_count   = psutil.cpu_count(logical=True)
    cpu_phys    = psutil.cpu_count(logical=False)

    # RAM
    ram = psutil.virtual_memory()

    # Disk(s)
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device":     part.device,
                "mountpoint": part.mountpoint,
                "total_gb":   round(usage.total / 1e9, 1),
                "used_gb":    round(usage.used / 1e9, 1),
                "free_gb":    round(usage.free / 1e9, 1),
                "percent":    round(usage.percent, 1)
            })
        except Exception:
            pass

    # Network throughput
    now_net     = psutil.net_io_counters()
    now_time    = time.time()
    dt          = max(now_time - last_net_time, 0.1)
    bytes_sent  = max(0, now_net.bytes_sent - last_net_io.bytes_sent)
    bytes_recv  = max(0, now_net.bytes_recv - last_net_io.bytes_recv)
    last_net_io  = now_net
    last_net_time = now_time

    net_info = {
        "sent_kbps": round(bytes_sent / dt / 1024, 1),
        "recv_kbps": round(bytes_recv / dt / 1024, 1),
        "total_sent_gb": round(now_net.bytes_sent / 1e9, 2),
        "total_recv_gb": round(now_net.bytes_recv / 1e9, 2)
    }

    # GPU
    gpus = _get_gpu_stats()

    # Top processes by CPU
    top_procs_cpu = []
    top_procs_ram = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            cpu  = p.info['cpu_percent'] or 0
            mem  = (p.info['memory_info'].rss / 1e6) if p.info['memory_info'] else 0
            top_procs_cpu.append({"pid": p.info['pid'], "name": p.info['name'],
                                   "cpu": round(cpu, 1), "mem_mb": round(mem, 0)})
            top_procs_ram.append({"pid": p.info['pid'], "name": p.info['name'],
                                   "cpu": round(cpu, 1), "mem_mb": round(mem, 0)})
        except Exception:
            pass

    top_procs_cpu.sort(key=lambda x: x['cpu'], reverse=True)
    top_procs_ram.sort(key=lambda x: x['mem_mb'], reverse=True)

    # Battery
    battery = None
    try:
        b = psutil.sensors_battery()
        if b:
            battery = {
                "percent":   round(b.percent, 1),
                "plugged":   b.power_plugged,
                "secs_left": b.secsleft if b.secsleft != psutil.POWER_TIME_UNLIMITED else -1
            }
    except Exception:
        pass

    return {
        "timestamp": datetime.now().isoformat(),
        "cpu": {
            "percent":       round(cpu_pct, 1),
            "logical_cores": cpu_count,
            "physical_cores": cpu_phys,
            "freq_mhz":      round(cpu_freq.current, 0) if cpu_freq else None
        },
        "ram": {
            "percent":       round(ram.percent, 1),
            "used_gb":       round(ram.used / 1e9, 2),
            "total_gb":      round(ram.total / 1e9, 2),
            "available_gb":  round(ram.available / 1e9, 2)
        },
        "disks":   disks,
        "network": net_info,
        "gpu":     gpus,
        "top_cpu": top_procs_cpu[:5],
        "top_ram": top_procs_ram[:5],
        "battery": battery
    }


# ─── Background Sampler ───────────────────────────────────────────────────────

def _sampler_loop():
    global sampler_active
    while sampler_active:
        try:
            data = _snapshot()
            cpu_history.append(data["cpu"]["percent"])
            ram_history.append(data["ram"]["percent"])
            if data["disks"]:
                disk_history.append(data["disks"][0]["percent"])
            if data["gpu"]:
                gpu_history.append(data["gpu"][0]["load_percent"])
            net_history.append(data["network"])
        except Exception as e:
            print(f"[HEALTH] Sampler error: {e}")
        time.sleep(SAMPLE_RATE)


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/health/snapshot", methods=["GET"])
def get_snapshot():
    """Full real-time system snapshot — the main HUD data source."""
    data = _snapshot()
    # Inject rolling history
    data["history"] = {
        "cpu":  list(cpu_history),
        "ram":  list(ram_history),
        "disk": list(disk_history),
        "gpu":  list(gpu_history)
    }
    return jsonify({"success": True, **data})


@app.route("/health/cpu", methods=["GET"])
def get_cpu():
    cpu_pct = psutil.cpu_percent(interval=0.5)
    freq    = psutil.cpu_freq()
    per_core = psutil.cpu_percent(percpu=True)
    return jsonify({
        "success":    True,
        "percent":    round(cpu_pct, 1),
        "per_core":   [round(c, 1) for c in per_core],
        "freq_mhz":   round(freq.current, 0) if freq else None,
        "history":    list(cpu_history)
    })


@app.route("/health/ram", methods=["GET"])
def get_ram():
    ram = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return jsonify({
        "success":      True,
        "percent":      round(ram.percent, 1),
        "used_gb":      round(ram.used / 1e9, 2),
        "total_gb":     round(ram.total / 1e9, 2),
        "available_gb": round(ram.available / 1e9, 2),
        "swap_percent": round(swap.percent, 1),
        "swap_used_gb": round(swap.used / 1e9, 2),
        "history":      list(ram_history)
    })


@app.route("/health/gpu", methods=["GET"])
def get_gpu():
    gpus = _get_gpu_stats()
    return jsonify({
        "success": True,
        "gpus":    gpus,
        "history": list(gpu_history)
    })


@app.route("/health/disk", methods=["GET"])
def get_disk():
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device":     part.device,
                "mountpoint": part.mountpoint,
                "total_gb":   round(usage.total / 1e9, 1),
                "used_gb":    round(usage.used / 1e9, 1),
                "free_gb":    round(usage.free / 1e9, 1),
                "percent":    round(usage.percent, 1)
            })
        except Exception:
            pass
    return jsonify({"success": True, "disks": disks, "history": list(disk_history)})


@app.route("/health/network", methods=["GET"])
def get_network():
    return jsonify({
        "success": True,
        "history": list(net_history)
    })


@app.route("/health/processes", methods=["GET"])
def get_processes():
    sort_by = request.args.get("sort", "cpu")  # 'cpu' or 'ram'
    limit   = int(request.args.get("limit", 10))

    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
        try:
            mem = (p.info['memory_info'].rss / 1e6) if p.info['memory_info'] else 0
            if mem > 1:  # skip near-zero memory processes
                procs.append({
                    "pid":    p.info['pid'],
                    "name":   p.info['name'],
                    "cpu":    round(p.info['cpu_percent'] or 0, 1),
                    "mem_mb": round(mem, 0),
                    "status": p.info['status']
                })
        except Exception:
            pass

    procs.sort(key=lambda x: x['cpu' if sort_by == 'cpu' else 'mem_mb'], reverse=True)
    return jsonify({"success": True, "processes": procs[:limit]})


@app.route("/health/battery", methods=["GET"])
def get_battery():
    try:
        b = psutil.sensors_battery()
        if b:
            return jsonify({
                "success":    True,
                "percent":    round(b.percent, 1),
                "plugged":    b.power_plugged,
                "secs_left":  b.secsleft if b.secsleft != psutil.POWER_TIME_UNLIMITED else -1
            })
    except Exception:
        pass
    return jsonify({"success": False, "message": "No battery info available."})


@app.route("/health/summary", methods=["GET"])
def get_summary():
    """
    A compact summary for HUD display:
    Returns CPU%, RAM%, top disk %, GPU load% in one fast call.
    """
    cpu   = psutil.cpu_percent(interval=0.1)
    ram   = psutil.virtual_memory()
    disk  = psutil.disk_usage("C:\\" if sys.platform == "win32" else "/")
    gpus  = _get_gpu_stats()
    gpu_load = gpus[0]["load_percent"] if gpus else None

    alert = None
    if cpu > 90:
        alert = f"CPU critical: {cpu}%"
    elif ram.percent > 85:
        alert = f"RAM critical: {round(ram.percent, 1)}%"
    elif disk.percent > 90:
        alert = f"Disk critical: {round(disk.percent, 1)}%"

    return jsonify({
        "success":    True,
        "cpu":        round(cpu, 1),
        "ram":        round(ram.percent, 1),
        "disk":       round(disk.percent, 1),
        "gpu":        gpu_load,
        "alert":      alert,
        "timestamp":  datetime.now().isoformat()
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "zaire-system-health"})


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE System Health Monitor")
    print("  Flask server on port 3009")
    print("==============================================\n")

    # Prime the CPU percent once (first call is always 0)
    psutil.cpu_percent(interval=0.5)

    # Start background sampler
    sampler_active = True
    sampler_thread = threading.Thread(target=_sampler_loop, daemon=True)
    sampler_thread.start()
    print("[HEALTH] Background sampler started (2s interval).")

    app.run(host="127.0.0.1", port=3009, debug=False, use_reloader=False)
