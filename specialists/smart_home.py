"""
ZAIRE Smart Home Control Daemon — Tier 6 Connectivity
Flask sidecar on port 3012

Feature 20 — Smart Home Control:
  - Manages states of virtual/physical devices (Lights, AC, Locks)
  - Provides a REST API for current status and control
  - Ready for Home Assistant / MQTT / Philips Hue integration
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ─────────────────────────── CONFIG ──────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
STATE_FILE  = BACKEND_DIR / "memory" / "smart_home.json"
STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

# Initial default state
DEFAULT_DEVICES = {
    "living_room_light": {"id": "living_room_light", "name": "Living Room Light", "type": "light", "state": "off", "brightness": 100},
    "study_lamp":         {"id": "study_lamp",         "name": "Study Lamp",         "type": "light", "state": "off", "brightness": 80},
    "ac_unit":            {"id": "ac_unit",            "name": "AC Unit",            "type": "ac",    "state": "off", "temp": 24},
    "main_door":          {"id": "main_door",          "name": "Main Door Lock",     "type": "lock",  "state": "locked"}
}

# ─────────────────────────── HELPERS ─────────────────────────────────────────

def _load_state():
    if not STATE_FILE.exists():
        _save_state(DEFAULT_DEVICES)
        return DEFAULT_DEVICES
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return DEFAULT_DEVICES

def _save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")

def _log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[SMART_HOME {ts}] {msg}", flush=True)

# ─────────────────────────── REST API ────────────────────────────────────────

@app.route("/devices", methods=["GET"])
def get_devices():
    """List all smart home devices and their current states."""
    return jsonify({"success": True, "devices": _load_state()})

@app.route("/control", methods=["POST"])
def control_device():
    """
    Control a specific device.
    Payload: { "device_id": "...", "action": "on|off|set", "params": {...} }
    """
    data = request.get_json() or {}
    dev_id = data.get("device_id")
    action = data.get("action")
    params = data.get("params", {})

    state = _load_state()
    if dev_id not in state:
        return jsonify({"success": False, "error": f"Device '{dev_id}' not found."}), 404

    device = state[dev_id]
    
    if action == "on":
        device["state"] = "on"
        _log(f"Turned ON {device['name']}")
    elif action == "off":
        device["state"] = "off"
        _log(f"Turned OFF {device['name']}")
    elif action == "set":
        # Update specific parameters (brightness, temp, etc.)
        for k, v in params.items():
            if k in device:
                device[k] = v
        _log(f"Set {device['name']} parameters: {params}")
    
    _save_state(state)
    return jsonify({"success": True, "message": f"{device['name']} updated.", "device": device})

@app.route("/scene", methods=["POST"])
def set_scene():
    """
    Execute a predefined scene.
    Payload: { "scene": "work|sleep|away" }
    """
    data = request.get_json() or {}
    scene = data.get("scene", "").lower()
    
    state = _load_state()
    
    if scene == "work":
        state["living_room_light"]["state"] = "off"
        state["study_lamp"]["state"] = "on"
        state["study_lamp"]["brightness"] = 100
        state["ac_unit"]["state"] = "on"
        state["ac_unit"]["temp"] = 22
        msg = "Work scene activated. Concentration mode engaged."
    elif scene == "sleep":
        for d in state.values():
            if d["type"] != "lock": d["state"] = "off"
        state["main_door"]["state"] = "locked"
        msg = "Sleep scene activated. All systems powered down."
    elif scene == "away":
        for d in state.values():
            if d["type"] == "lock": d["state"] = "locked"
            else: d["state"] = "off"
        msg = "Away scene activated. Security locks engaged."
    else:
        return jsonify({"success": False, "error": "Unknown scene."}), 400

    _save_state(state)
    _log(f"Scene executed: {scene.upper()}")
    return jsonify({"success": True, "message": msg})

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "smart-home-control", "devices_count": len(_load_state())})

if __name__ == "__main__":
    _log("ZAIRE Smart Home Hub initialized.")
    app.run(host="127.0.0.1", port=3012, debug=False)
