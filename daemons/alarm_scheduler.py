"""
ZAIRE Smart Alarm & Scheduler — Tier 4 Automation (#15)
Flask sidecar on port 3010.

Sets real Windows alarms using Windows Task Scheduler (schtasks).
Supports:
  - One-shot alarms ("Wake me at 7am", "Remind me at 3:30pm")
  - Recurring alarms (daily briefings, break reminders)
  - Morning briefing integration (pushes 'daily_briefing' event to ZAIRE)
  - Full alarm management (list, delete, snooze)

Install: pip install flask flask-cors (psutil already installed)
"""

import os
import sys
import json
import re
import subprocess
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError as e:
    print(f"[ALARM] Missing: {e}")
    print("Run: pip install flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Config ──────────────────────────────────────────────────────────────────
ZAIRE_BACKEND      = "http://127.0.0.1:3001"
ALARM_STORE_PATH = Path(__file__).parent / "memory" / "alarms.json"
ALARM_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)

# ─── Alarm Store ─────────────────────────────────────────────────────────────

def _load_alarms() -> list:
    try:
        if ALARM_STORE_PATH.exists():
            return json.loads(ALARM_STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def _save_alarms(alarms: list):
    ALARM_STORE_PATH.write_text(
        json.dumps(alarms, indent=2, default=str),
        encoding="utf-8"
    )


def _next_alarm_id() -> str:
    alarms = _load_alarms()
    ids = [a.get("id", 0) for a in alarms if isinstance(a.get("id"), int)]
    return max(ids, default=0) + 1


# ─── Windows Task Scheduler Integration ──────────────────────────────────────

def _zaire_callback_script(alarm_id: int, label: str) -> str:
    """Return the PowerShell one-liner that fires the ZAIRE callback."""
    msg = label.replace('"', '\\"')
    return (
        f'powershell -Command "Invoke-RestMethod -Uri '
        f"'http://127.0.0.1:3001/alarm/fire' "
        f'-Method Post -ContentType application/json '
        f'-Body \\\"{{\\\\\\\"id\\\\\\\":{alarm_id},\\\\\\\"label\\\\\\\":\\\\\\\"{msg}\\\\\\\"}}\\\"'
        f'"'
    )


def _create_windows_task(alarm_id: int, label: str, fire_time: datetime,
                          recur: str = "once") -> tuple[bool, str]:
    """Register the alarm with Windows Task Scheduler."""
    task_name = f"ZAIRE_Alarm_{alarm_id}"
    time_str  = fire_time.strftime("%H:%M")
    date_str  = fire_time.strftime("%Y/%m/%d")

    script = _zaire_callback_script(alarm_id, label)

    # Build schtasks command
    if recur == "daily":
        cmd = (
            f'schtasks /Create /F /TN "{task_name}" /TR "{script}" '
            f'/SC DAILY /ST {time_str}'
        )
    elif recur == "weekdays":
        cmd = (
            f'schtasks /Create /F /TN "{task_name}" /TR "{script}" '
            f'/SC WEEKLY /D MON,TUE,WED,THU,FRI /ST {time_str}'
        )
    else:  # once
        cmd = (
            f'schtasks /Create /F /TN "{task_name}" /TR "{script}" '
            f'/SC ONCE /ST {time_str} /SD {date_str}'
        )

    try:
        r = subprocess.run(cmd, shell=True, capture_output=True,
                           text=True, timeout=15)
        if r.returncode == 0:
            return True, f"Task '{task_name}' registered."
        else:
            return False, r.stderr.strip() or r.stdout.strip()
    except Exception as e:
        return False, str(e)


def _delete_windows_task(alarm_id: int) -> tuple[bool, str]:
    task_name = f"ZAIRE_Alarm_{alarm_id}"
    cmd = f'schtasks /Delete /F /TN "{task_name}"'
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return r.returncode == 0, r.stdout.strip() or r.stderr.strip()
    except Exception as e:
        return False, str(e)


# ─── Fallback: Pure-Python countdown (when not on Windows or schtasks fails) ──

_soft_alarm_threads: dict[int, threading.Event] = {}


def _start_soft_alarm(alarm_id: int, label: str, fire_time: datetime):
    """Thread-based fallback alarm that fires without schtasks."""
    stop_event = threading.Event()
    _soft_alarm_threads[alarm_id] = stop_event

    def _run():
        now   = datetime.now()
        delta = (fire_time - now).total_seconds()
        if delta <= 0:
            return

        print(f"[ALARM] Soft alarm #{alarm_id} set for {delta:.0f}s: {label}")
        if stop_event.wait(timeout=delta):
            print(f"[ALARM] Soft alarm #{alarm_id} cancelled.")
            return

        _fire_alarm(alarm_id, label)

    t = threading.Thread(target=_run, daemon=True)
    t.start()


def _fire_alarm(alarm_id: int, label: str):
    """Push alarm event to ZAIRE backend + Windows toast notification."""
    print(f"[ALARM] 🔔 FIRING Alarm #{alarm_id}: {label}")

    # Push to ZAIRE
    try:
        import requests
        requests.post(
            f"{ZAIRE_BACKEND}/alarm/fire",
            json={"id": alarm_id, "label": label},
            timeout=3
        )
    except Exception as e:
        print(f"[ALARM] Callback failed: {e}")

    # Windows toast notification (best-effort)
    try:
        toast_cmd = (
            f'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; '
            f'[System.Windows.Forms.MessageBox]::Show(\'{label}\', \'ZAIRE Alarm\', '
            f"'OK', 'Information')\""
        )
        subprocess.Popen(toast_cmd, shell=True)
    except Exception:
        pass


# ─── Natural Language Time Parser ─────────────────────────────────────────────

def _parse_time(text: str) -> datetime | None:
    """
    Parse natural-language time expressions from user messages.
    Examples: "7am", "3:30 PM", "in 15 minutes", "tomorrow at 9am"
    """
    now   = datetime.now()
    lower = text.lower().strip()

    # "in X minutes/hours"
    m = re.search(r'in\s+(\d+)\s*(minute|min|hour|hr)', lower)
    if m:
        qty  = int(m.group(1))
        unit = m.group(2)
        delta = timedelta(minutes=qty) if "min" in unit else timedelta(hours=qty)
        return now + delta

    # "HH:MM am/pm" or "H am/pm"
    m = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', lower)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2)) if m.group(2) else 0
        meridiem = m.group(3)
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)  # schedule for tomorrow if time passed
        return target

    # 24h "HH:MM"
    m = re.search(r'\b(\d{1,2}):(\d{2})\b', lower)
    if m:
        target = now.replace(hour=int(m.group(1)), minute=int(m.group(2)),
                             second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return target

    return None


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/alarm/set", methods=["POST"])
def set_alarm():
    """
    Set a new alarm.
    Body: {
      "label": "Wake up sir!",
      "time":  "7:00 AM"  | "in 30 minutes" | ISO datetime,
      "recur": "once" | "daily" | "weekdays"  (default: "once")
    }
    """
    data  = request.get_json()
    label = data.get("label", "ZAIRE Alarm")
    time_str = data.get("time", "")
    recur    = data.get("recur", "once")

    # Parse time
    fire_time = None
    # Try ISO first
    try:
        fire_time = datetime.fromisoformat(time_str)
    except Exception:
        fire_time = _parse_time(time_str)

    if not fire_time:
        return jsonify({"success": False,
                        "error": f"Could not parse time: '{time_str}'"}), 400

    alarm_id  = _next_alarm_id()
    fire_time_str = fire_time.strftime("%Y-%m-%d %H:%M")

    # Try Windows Task Scheduler first
    ok, msg = _create_windows_task(alarm_id, label, fire_time, recur)
    method   = "schtasks"

    if not ok:
        # Fallback to Python thread
        print(f"[ALARM] schtasks failed ({msg}), using soft alarm.")
        _start_soft_alarm(alarm_id, label, fire_time)
        method = "soft"

    # Save to store
    alarms = _load_alarms()
    alarms.append({
        "id":        alarm_id,
        "label":     label,
        "fire_time": fire_time_str,
        "recur":     recur,
        "method":    method,
        "created":   datetime.now().isoformat(),
        "active":    True
    })
    _save_alarms(alarms)

    print(f"[ALARM] ✓ Alarm #{alarm_id} set — {label} — {fire_time_str} ({recur}/{method})")
    return jsonify({
        "success":   True,
        "alarm_id":  alarm_id,
        "label":     label,
        "fire_time": fire_time_str,
        "recur":     recur,
        "method":    method,
        "message":   f"Alarm set for {fire_time_str}."
    })


@app.route("/alarm/list", methods=["GET"])
def list_alarms():
    alarms = _load_alarms()
    active = [a for a in alarms if a.get("active", True)]
    return jsonify({"success": True, "alarms": active, "count": len(active)})


@app.route("/alarm/delete", methods=["POST"])
def delete_alarm():
    data     = request.get_json()
    alarm_id = int(data.get("id", -1))

    alarms = _load_alarms()
    found  = False
    for a in alarms:
        if a.get("id") == alarm_id:
            a["active"] = False
            found = True
            break

    if not found:
        return jsonify({"success": False, "error": "Alarm not found."}), 404

    _save_alarms(alarms)

    # Cancel soft alarm if running
    if alarm_id in _soft_alarm_threads:
        _soft_alarm_threads[alarm_id].set()
        del _soft_alarm_threads[alarm_id]

    # Remove from Task Scheduler
    _delete_windows_task(alarm_id)

    return jsonify({"success": True, "message": f"Alarm #{alarm_id} cancelled."})


@app.route("/alarm/snooze", methods=["POST"])
def snooze_alarm():
    """Snooze an alarm by N minutes (default 10)."""
    data     = request.get_json()
    alarm_id = int(data.get("id", -1))
    minutes  = int(data.get("minutes", 10))

    alarms = _load_alarms()
    alarm  = next((a for a in alarms if a.get("id") == alarm_id), None)
    if not alarm:
        return jsonify({"success": False, "error": "Alarm not found."}), 404

    # Delete old
    _delete_windows_task(alarm_id)
    if alarm_id in _soft_alarm_threads:
        _soft_alarm_threads[alarm_id].set()

    # Create new at +N minutes
    new_time = datetime.now() + timedelta(minutes=minutes)
    new_id   = _next_alarm_id()
    label    = alarm.get("label", "Snoozed Alarm")

    ok, _ = _create_windows_task(new_id, label, new_time, "once")
    if not ok:
        _start_soft_alarm(new_id, label, new_time)

    alarm["active"] = False
    alarms.append({
        "id":        new_id,
        "label":     label,
        "fire_time": new_time.strftime("%Y-%m-%d %H:%M"),
        "recur":     "once",
        "method":    "snoozed",
        "created":   datetime.now().isoformat(),
        "active":    True
    })
    _save_alarms(alarms)

    return jsonify({
        "success": True,
        "new_alarm_id": new_id,
        "fires_at": new_time.strftime("%H:%M"),
        "message": f"Snoozed for {minutes} minutes. New alarm at {new_time.strftime('%H:%M')}."
    })


@app.route("/alarm/parse_time", methods=["POST"])
def parse_time_endpoint():
    """Test-only endpoint: check how a time string will be parsed."""
    data = request.get_json()
    text = data.get("text", "")
    t    = _parse_time(text)
    return jsonify({
        "input":  text,
        "parsed": t.isoformat() if t else None,
        "human":  t.strftime("%A, %d %b %Y at %H:%M") if t else "Could not parse"
    })


@app.route("/health", methods=["GET"])
def health():
    alarms = _load_alarms()
    active = [a for a in alarms if a.get("active", True)]
    return jsonify({
        "status":        "ok",
        "service":       "zaire-alarm-scheduler",
        "active_alarms": len(active)
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE Smart Alarm & Scheduler")
    print("  Flask server on port 3010")
    print("==============================================\n")

    # Restore any active soft alarms on startup
    alarms = _load_alarms()
    restored = 0
    for a in alarms:
        if a.get("active") and a.get("method") == "soft":
            try:
                ft = datetime.fromisoformat(a["fire_time"])
                if ft > datetime.now():
                    _start_soft_alarm(a["id"], a["label"], ft)
                    restored += 1
            except Exception:
                pass
    if restored:
        print(f"[ALARM] Restored {restored} pending soft alarm(s).")

    app.run(host="127.0.0.1", port=3010, debug=False, use_reloader=False)
