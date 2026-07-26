"""
ZAIRE Face Security Daemon — Tier 5 Security
Flask sidecar on port 3011

Feature 17 — Face-Lock Mode:
  - Runs a continuous webcam loop
  - If Mughees walks away (no master face for N seconds) → locks the PC
  - When master face re-appears → sends unlock signal → PC unlocks

Feature 18 — Intruder Snapshot:
  - Unknown face detected → saves timestamped photo
  - Sends Pushbullet push notification with the image file
  - Optionally locks the PC and speaks an alert via ZAIRE

Architecture:
  - Pure Flask REST API (no tkinter, no FastAPI dependency clash)
  - Shares master_face.jpg with observer_daemon.py
  - Can run standalone or be started by index.js
  - All state persisted to memory/security_log.json
"""

import os
import sys
import json
import time
import base64
import threading
import subprocess
import io
from datetime import datetime
from pathlib import Path

# ── Flask ────────────────────────────────────────────────────────────────────
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    print("[SECURITY] pip install flask flask-cors")
    sys.exit(1)

# ── OpenCV ───────────────────────────────────────────────────────────────────
try:
    import cv2
    import numpy as np
    CV2_OK = True
except ImportError:
    CV2_OK = False
    print("[SECURITY] ⚠ OpenCV not found. Run: pip install opencv-python")

# ── face_recognition ─────────────────────────────────────────────────────────
try:
    import face_recognition
    FR_OK = True
except ImportError:
    FR_OK = False
    print("[SECURITY] ⚠ face_recognition not found. Run: pip install face-recognition")

# ── Pillow (for image saving fallback) ───────────────────────────────────────
try:
    from PIL import Image
    PIL_OK = True
except ImportError:
    PIL_OK = False

app  = Flask(__name__)
CORS(app)

# ─────────────────────────── CONFIG ──────────────────────────────────────────
BACKEND_URL       = "http://127.0.0.1:3001"
MASTER_FACE_PATH  = Path(__file__).parent / "master_face.jpg"
SECURITY_LOG      = Path(__file__).parent / "memory" / "security_log.json"
SNAPSHOT_DIR      = Path(__file__).parent / "memory" / "intruder_snapshots"
SECURITY_LOG.parent.mkdir(parents=True, exist_ok=True)
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Face-Lock tuning
ABSENT_LOCK_SECONDS    = int(os.getenv("ZAIRE_LOCK_DELAY",    "15"))   # seconds absent before lock
UNLOCK_CONFIRM_FRAMES  = int(os.getenv("ZAIRE_UNLOCK_FRAMES",  "3"))   # consecutive master frames to unlock
INTRUDER_COOLDOWN_SECS = int(os.getenv("ZAIRE_INTRUDER_COOLDOWN", "30")) # min seconds between intruder alerts
CAMERA_INDEX          = int(os.getenv("ZAIRE_CAMERA_INDEX",   "0"))
NO_FACE_GRACE_SECONDS = float(os.getenv("ZAIRE_NO_FACE_GRACE", "8"))
LOCK_COOLDOWN_SECONDS = float(os.getenv("ZAIRE_LOCK_COOLDOWN", "12"))
MATCH_TOLERANCE_BRIGHT = float(os.getenv("ZAIRE_MATCH_TOLERANCE_BRIGHT", "0.55"))
MATCH_TOLERANCE_DARK   = float(os.getenv("ZAIRE_MATCH_TOLERANCE_DARK", "0.62"))
MIN_BRIGHTNESS_FOR_BRIGHT_TOL = float(os.getenv("ZAIRE_BRIGHTNESS_SWITCH", "65"))

# ─────────────────────────── STATE ───────────────────────────────────────────
state = {
    "last_notified_presence": "none",
    "face_lock_enabled":    False,
    "pc_locked":            False,
    "master_present":       False,
    "last_seen_master":     time.time(),
    "intruder_alert_last":  0.0,
    "intruder_present":     False,
    "master_confirm_count": 0,
    "camera_ok":            False,
    "running":              False,
    "total_locks":          0,
    "total_intruders":      0,
    "last_event":           None,
    "security_disabled":    False,
    "master_miss_count":    0,
    "last_lock_time":       0.0,
    "current_lock_delay":   ABSENT_LOCK_SECONDS,
}

_master_encoding  = None   # numpy array
_frame_lock       = threading.Lock()
_last_frame       = None   # latest OpenCV BGR frame
_stop_event       = threading.Event()
_vision_thread    = None

# ─────────────────────────── HELPERS ─────────────────────────────────────────

def _log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[SECURITY {ts}] {msg}", flush=True)


def _load_security_log() -> list:
    try:
        if SECURITY_LOG.exists():
            return json.loads(SECURITY_LOG.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def _append_log(event_type: str, detail: str, snapshot_path: str = ""):
    events = _load_security_log()
    events.append({
        "type":     event_type,
        "detail":   detail,
        "snapshot": snapshot_path,
        "time":     datetime.now().isoformat(),
    })
    events = events[-200:]  # keep last 200 events
    SECURITY_LOG.write_text(json.dumps(events, indent=2), encoding="utf-8")
    state["last_event"] = {"type": event_type, "detail": detail, "time": datetime.now().isoformat()}


def _enhance_low_light(frame):
    """
    Improve recognition stability in low light:
    - CLAHE on luminance
    - mild denoise
    """
    try:
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        y, cr, cb = cv2.split(ycrcb)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        y2 = clahe.apply(y)
        merged = cv2.merge((y2, cr, cb))
        out = cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)
        out = cv2.fastNlMeansDenoisingColored(out, None, 3, 3, 7, 21)
        return out
    except Exception:
        return frame


def _load_master_encoding():
    global _master_encoding
    if not (CV2_OK and FR_OK):
        return
    if not MASTER_FACE_PATH.exists():
        _log("master_face.jpg not found — run /security/register first.")
        return
    try:
        img_bgr  = cv2.imread(str(MASTER_FACE_PATH))
        img_rgb  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_rgb  = np.ascontiguousarray(img_rgb, dtype=np.uint8)
        encodings = face_recognition.face_encodings(img_rgb)
        if encodings:
            _master_encoding = encodings[0]
            _log(f"✓ Master biometric loaded ({MASTER_FACE_PATH.name})")
        else:
            _log("⚠ No face detected in master_face.jpg — please re-register.")
    except Exception as e:
        _log(f"Error loading master face: {e}")


# ─────────────────────────── PC LOCK / UNLOCK ────────────────────────────────

def _lock_pc():
    """Lock Windows immediately."""
    try:
        subprocess.run(
            ["rundll32.exe", "user32.dll,LockWorkStation"],
            check=True, timeout=5
        )
        _log("🔒 PC LOCKED")
        return True
    except Exception as e:
        _log(f"Lock failed: {e}")
        return False


def _unlock_pc():
    """
    Unlock: send Enter key to wake screen, then simulate password entry.
    Windows Hello / PIN won't be bypassed — we just wake and notify.
    The user's face was verified by our own model; we push a 'presence' event
    to ZAIRE so the frontend can show an unlock notification.
    """
    try:
        import ctypes
        # Simulates pressing a key to wake the screen (works if PC just dimmed)
        # For hard-locked sessions, notify ZAIRE; user must enter PIN/Hello
        ctypes.windll.user32.keybd_event(0x0D, 0, 0, 0)  # Enter
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(0x0D, 0, 2, 0)  # Key up
    except Exception:
        pass

    # Notify ZAIRE backend
    try:
        import requests
        requests.post(
            f"{BACKEND_URL}/presence",
            json={"status": "unlocked", "user": "Master"},
            timeout=2
        )
    except Exception:
        pass
    _log("🔓 Face verified — unlock signal sent.")


# ─────────────────────────── INTRUDER ALERT ──────────────────────────────────

def _save_snapshot(frame) -> str:
    """Save a BGR OpenCV frame as a jpeg snapshot. Returns file path."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    snap_path = SNAPSHOT_DIR / f"intruder_{ts}.jpg"
    try:
        cv2.imwrite(str(snap_path), frame)
        _log(f"📸 Snapshot saved: {snap_path.name}")
        return str(snap_path)
    except Exception as e:
        _log(f"Snapshot save failed: {e}")
        return ""


def _send_pushbullet_alert(snapshot_path: str):
    """
    Send Pushbullet notification with the intruder snapshot.
    Falls back to note if file push fails.
    """
    pb_token = os.getenv("PUSHBULLET_TOKEN", "")
    if not pb_token:
        _log("Pushbullet skipped — PUSHBULLET_TOKEN not in .env")
        return

    try:
        from pushbullet import Pushbullet
        pb  = Pushbullet(pb_token)
        ts  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        title = "⚠️ ZAIRE SECURITY ALERT"
        body  = f"Unknown face detected at your PC — {ts}"

        if snapshot_path and Path(snapshot_path).exists():
            with open(snapshot_path, "rb") as f:
                file_data = pb.upload_file(f, f"intruder_{ts}.jpg")
            pb.push_file(**file_data, title=title, body=body)
            _log("📲 Pushbullet file alert sent.")
        else:
            pb.push_note(title, body)
            _log("📲 Pushbullet note alert sent.")
    except ImportError:
        _log("pushbullet.py not installed — pip install pushbullet.py")
    except Exception as e:
        _log(f"Pushbullet error: {e}")


def _send_telegram_alert(snapshot_path: str):
    """Optional Telegram photo alert — only if TELEGRAM_BOT_TOKEN is set."""
    bot_token   = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id     = os.getenv("TELEGRAM_ALERT_CHAT_ID", "")
    if not (bot_token and chat_id):
        return
    try:
        import requests
        ts    = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        caption = f"⚠️ ZAIRE SECURITY — Unknown face at PC\n{ts}"

        if snapshot_path and Path(snapshot_path).exists():
            with open(snapshot_path, "rb") as photo:
                requests.post(
                    f"https://api.telegram.org/bot{bot_token}/sendPhoto",
                    data={"chat_id": chat_id, "caption": caption},
                    files={"photo": photo},
                    timeout=15
                )
        else:
            requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": caption},
                timeout=10
            )
        _log("📲 Telegram alert sent.")
    except Exception as e:
        _log(f"Telegram alert error: {e}")


def _notify_zaire_intruder(snapshot_path: str):
    """Tell the ZAIRE Node.js backend about the intruder (broadcasts to frontend)."""
    try:
        import requests
        b64_img = ""
        if snapshot_path and Path(snapshot_path).exists():
            with open(snapshot_path, "rb") as f:
                b64_img = base64.b64encode(f.read()).decode("utf-8")

        requests.post(
            f"{BACKEND_URL}/security/intruder",
            json={
                "timestamp":   datetime.now().isoformat(),
                "snapshot":    snapshot_path,
                "snapshot_b64": b64_img[:50000] if b64_img else "",
            },
            timeout=3
        )
    except Exception as e:
        _log(f"ZAIRE intruder notify failed: {e}")


def _trigger_intruder_response(frame):
    """Full intruder response pipeline: snapshot → Pushbullet → Telegram → ZAIRE."""
    now = time.time()
    if now - state["intruder_alert_last"] < INTRUDER_COOLDOWN_SECS:
        return  # Rate-limit alerts

    state["intruder_alert_last"] = now
    state["total_intruders"]    += 1
    state["intruder_present"]    = True

    snap_path = _save_snapshot(frame)
    _append_log("INTRUDER", "Unknown face detected and captured.", snap_path)

    # Run all notification channels in background
    def _notify():
        _send_pushbullet_alert(snap_path)
        _send_telegram_alert(snap_path)
        _notify_zaire_intruder(snap_path)
        # Also lock the PC if face-lock is enabled
        if state["face_lock_enabled"] and not state["pc_locked"]:
            _lock_pc()
            state["pc_locked"] = True
            _append_log("LOCK", "PC locked due to intruder detection.")

    threading.Thread(target=_notify, daemon=True).start()


# ─────────────────────────── VISION LOOP ─────────────────────────────────────

def _vision_loop():
    """
    Main camera + face recognition loop.
    Runs in a daemon thread. Controlled by _stop_event.
    """
    global _last_frame, _master_encoding

    if not (CV2_OK and FR_OK):
        _log("Vision disabled — missing cv2 or face_recognition.")
        state["camera_ok"] = False
        state["running"]   = False
        return

    _load_master_encoding()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        _log(f"❌ Cannot open camera {CAMERA_INDEX}")
        state["camera_ok"] = False
        state["running"]   = False
        return

    state["camera_ok"] = True
    state["running"]   = True
    _log(f"📷 Camera {CAMERA_INDEX} opened. Security loop active.")

    # Reload master encoding if it changes on disk
    # Try DSHOW first for Windows stability, fallback to default
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(CAMERA_INDEX)
        
    _master_face_mtime = MASTER_FACE_PATH.stat().st_mtime if MASTER_FACE_PATH.exists() else 0.0
    _frame_counter     = 0
    _consecutive_lost  = 0

    while not _stop_event.is_set():
        if state["security_disabled"]:
            state["running"] = False
            state["intruder_present"] = False
            time.sleep(2)
            continue

        ret, frame = cap.read()
        if not ret or frame is None:
            _consecutive_lost += 1
            _log(f"⚠ Camera frame lost ({_consecutive_lost}). Retrying...")
            
            # If we lose many frames, try re-initializing the handle
            if _consecutive_lost > 5:
                _log("🔄 Consecuitve frame loss — re-initializing camera handle (DSHOW)...")
                cap.release()
                time.sleep(2)
                cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(CAMERA_INDEX)
                _consecutive_lost = 0
                
            time.sleep(1)
            continue

        _consecutive_lost = 0
        with _frame_lock:
            _last_frame = frame.copy()

        _frame_counter += 1

        # Only run heavy recognition every 2nd frame to save CPU while maintaining speed
        if _frame_counter % 2 != 0:
            time.sleep(0.05)
            continue

        # Hot-reload master face if file changed
        if MASTER_FACE_PATH.exists():
            mtime = MASTER_FACE_PATH.stat().st_mtime
            if mtime != _master_face_mtime:
                _log("Master face file changed — reloading encoding.")
                _load_master_encoding()
                _master_face_mtime = mtime

        # ── Auto-Registration ────────────────────────────────────────────────
        if not MASTER_FACE_PATH.exists() and _frame_counter % 20 == 0:
            try:
                rgb_test = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                locs = face_recognition.face_locations(rgb_test, model="hog")
                if len(locs) > 0:
                    cv2.imwrite(str(MASTER_FACE_PATH), frame)
                    _log("🤖 FIRST-TIME SETUP: Auto-registered Master Face successfully!")
                    # Inform the backend so TTS can announce it
                    try:
                        import requests
                        requests.post(f"{BACKEND_URL}/presence", json={"status": "registered", "user": "Master"}, timeout=2)
                    except Exception:
                        pass
                    _load_master_encoding()
            except Exception as e:
                _log(f"Auto-registration error: {e}")

        # ── Detect Faces ─────────────────────────────────────────────────────
        try:
            gray_preview = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            avg_brightness = float(np.mean(gray_preview))
            working_frame = _enhance_low_light(frame) if avg_brightness < MIN_BRIGHTNESS_FOR_BRIGHT_TOL else frame

            small       = cv2.resize(working_frame, (0, 0), fx=0.5, fy=0.5)
            rgb_small   = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            rgb_small   = np.ascontiguousarray(rgb_small, dtype=np.uint8)
            rgb_full    = cv2.cvtColor(working_frame, cv2.COLOR_BGR2RGB)
            rgb_full    = np.ascontiguousarray(rgb_full, dtype=np.uint8)

            locations_small = face_recognition.face_locations(rgb_small, model="hog")
            locations_full  = [(t*2, r*2, b*2, l*2) for (t, r, b, l) in locations_small]
        except Exception as e:
            _log(f"Detection error: {e}")
            time.sleep(1)
            continue

        # ── No Face ──────────────────────────────────────────────────────────
        if not locations_full:
            state["master_miss_count"] += 1
            state["intruder_present"] = False
            if state["master_present"]:
                absent_secs = time.time() - state["last_seen_master"]
                # Longer grace period to avoid flicker-based false locks
                if absent_secs > NO_FACE_GRACE_SECONDS:
                    state["master_present"]       = False
                    state["master_confirm_count"] = 0
                    if state.get("last_notified_presence") != "absent":
                        _log(f"👤 Master absent (gone {absent_secs:.0f}s)")
                        state["last_notified_presence"] = "absent"

            # Face-Lock: lock PC if absent long enough
            if (state["face_lock_enabled"]
                    and not state["pc_locked"]
                    and not state["master_present"]):
                absent_secs = time.time() - state["last_seen_master"]
                long_enough = absent_secs >= state.get("current_lock_delay", ABSENT_LOCK_SECONDS)
                cooldown_over = (time.time() - state.get("last_lock_time", 0.0)) >= LOCK_COOLDOWN_SECONDS
                if long_enough and cooldown_over:
                    _log(f"🔒 Locking PC — absent {absent_secs:.0f}s")
                    if _lock_pc():
                        state["pc_locked"] = True
                        state["total_locks"] += 1
                        state["last_lock_time"] = time.time()
                        _append_log("LOCK", f"PC auto-locked after {absent_secs:.0f}s absence.")
            time.sleep(0.8)
            continue

        # ── Faces Found — Identify ────────────────────────────────────────────
        try:
            encodings = face_recognition.face_encodings(rgb_full, locations_full)
        except Exception as e:
            _log(f"Encoding error: {e}")
            time.sleep(0.5)
            continue

        master_found   = False
        intruder_found = False

        for enc in encodings:
            if _master_encoding is not None:
                dynamic_tolerance = MATCH_TOLERANCE_DARK if avg_brightness < MIN_BRIGHTNESS_FOR_BRIGHT_TOL else MATCH_TOLERANCE_BRIGHT
                match = face_recognition.compare_faces(
                    [_master_encoding], enc, tolerance=dynamic_tolerance
                )
                if match[0]:
                    master_found = True
        # ── Master Detected ───────────────────────────────────────────────────
        if master_found:
            state["last_seen_master"] = time.time()
            state["master_confirm_count"] += 1
            state["master_miss_count"] = 0

            if not state["master_present"]:
                _log(f"✅ Master confirmed (frame {state['master_confirm_count']}/{UNLOCK_CONFIRM_FRAMES})")

            if state["master_confirm_count"] >= UNLOCK_CONFIRM_FRAMES:
                if not state["master_present"]:
                    state["master_present"] = True
                    _log("✅ Master PRESENCE confirmed.")
                    _append_log("UNLOCK", "Master face confirmed — presence restored.")

                    # If PC was locked by face-lock, send unlock signal
@app.route("/security/start", methods=["POST"])
def start_face_lock():
    """Enable Face-Lock mode and start the vision loop."""
    global _vision_thread, _stop_event

    data            = request.get_json() or {}
    lock_delay      = data.get("lock_delay_seconds", ABSENT_LOCK_SECONDS)
    state["face_lock_enabled"] = True
    state["last_seen_master"]  = time.time()
    state["current_lock_delay"] = int(lock_delay) if str(lock_delay).isdigit() else ABSENT_LOCK_SECONDS

    if not state["running"]:
        _stop_event.clear()
        _vision_thread = threading.Thread(target=_vision_loop, daemon=True)
        _vision_thread.start()
        _log(f"🛡 Face-Lock enabled (lock after {state['current_lock_delay']}s absence)")

    _append_log("FACE_LOCK_ON", f"Face-Lock activated. Lock delay: {state['current_lock_delay']}s")
    return jsonify({
        "success":  True,
        "message":  f"Face-Lock active, sir. I'll lock your PC if you're absent for {state['current_lock_delay']}s.",
        "settings": {
            "lock_delay_seconds":   state["current_lock_delay"],
            "unlock_frames":        UNLOCK_CONFIRM_FRAMES,
            "intruder_cooldown":    INTRUDER_COOLDOWN_SECS,
        }
    })


@app.route("/security/stop", methods=["POST"])
def stop_face_lock():
    """Disable Face-Lock mode (keeps camera running for intruder detection if separate)."""
    state["face_lock_enabled"] = False
    _stop_event.set()
    _append_log("FACE_LOCK_OFF", "Face-Lock deactivated.")
    _log("🛡 Face-Lock DISABLED.")
    return jsonify({"success": True, "message": "Face-Lock disabled, sir."})


@app.route("/security/toggle_system", methods=["POST"])
def toggle_security_system():
    """Fully disable or enable the entire security logic."""
    data = request.get_json() or {}
    disabled = data.get("disabled", not state["security_disabled"])
    state["security_disabled"] = disabled
    
    msg = "Security system fully DISABLED, sir." if disabled else "Security system fully ARMED, sir."
    _log(f"🛡 {msg}")
    _append_log("SYSTEM_TOGGLE", msg)
    
    return jsonify({"success": True, "message": msg, "disabled": disabled})


@app.route("/security/register", methods=["POST"])
def register_master_face():
    """
    Capture current webcam frame and save as master_face.jpg.
    Can also accept a base64 image from the frontend.
    """
    global _master_encoding

    data   = request.get_json() or {}
    b64img = data.get("image_b64", "")

    if b64img:
        # Frontend uploaded a base64 image (e.g. from webcam widget)
        try:
            img_data = base64.b64decode(b64img.split(",")[-1])
            img_pil  = Image.open(io.BytesIO(img_data))
            img_pil.save(str(MASTER_FACE_PATH))
            _load_master_encoding()
            if _master_encoding is None:
                return jsonify({"success": False, "error": "No face detected in uploaded image."}), 400
            _append_log("REGISTER", "Master face registered from frontend image.")
            return jsonify({"success": True, "message": "Biometric signature updated from uploaded image, sir."})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # Use live webcam frame
    with _frame_lock:
        frame = _last_frame.copy() if _last_frame is not None else None

    if frame is None:
        # Vision loop not running — open camera briefly
        if CV2_OK:
            cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(CAMERA_INDEX)
            ret, frame = cap.read()
            cap.release()
        if frame is None:
            return jsonify({"success": False, "error": "No camera frame available. Please ensure your camera is not in use by another app."}), 400

    if not (CV2_OK and FR_OK):
        return jsonify({"success": False, "error": "Vision libraries not available."}), 500

    # Verification and Lighting Check
    gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    avg_bri = np.mean(gray)
    if avg_bri < 40:
        return jsonify({"success": False, "error": "Sir, it's too dark to register your face. Please turn on a light."}), 400

    # Detect Face (at slightly larger scale for registration quality)
    small   = cv2.resize(frame, (0, 0), fx=0.6, fy=0.6)
    rgb_s   = np.ascontiguousarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB), dtype=np.uint8)
    faces   = face_recognition.face_locations(rgb_s, model="hog")

    if not faces:
        return jsonify({"success": False, "error": "Sir, I don't see a face. Please look directly at the camera sensor."}), 400

    cv2.imwrite(str(MASTER_FACE_PATH), frame)
    _load_master_encoding()
    _append_log("REGISTER", "Master face registered from live webcam.")
    _log("✅ Master face registered.")
    return jsonify({"success": True, "message": "Biometric signature registered, sir. Face-Lock is ready."})


@app.route("/security/status", methods=["GET"])
def get_status():
    """Return full security state."""
    return jsonify({
        "success":           True,
        "face_lock_enabled": state["face_lock_enabled"],
        "pc_locked":         state["pc_locked"],
        "master_present":    state["master_present"],
        "intruder_present":  state["intruder_present"],
        "camera_ok":         state["camera_ok"],
        "running":           state["running"],
        "total_locks":       state["total_locks"],
        "total_intruders":   state["total_intruders"],
        "last_event":        state["last_event"],
        "security_disabled": state["security_disabled"],
        "master_face_exists": MASTER_FACE_PATH.exists(),
        "absent_lock_delay":  state.get("current_lock_delay", ABSENT_LOCK_SECONDS),
        "snapshot_dir":       str(SNAPSHOT_DIR),
    })


@app.route("/security/snapshots", methods=["GET"])
def list_snapshots():
    """List all intruder snapshots with base64 thumbnails."""
    snaps = sorted(SNAPSHOT_DIR.glob("*.jpg"), reverse=True)[:20]
    results = []
    for s in snaps:
        try:
            with open(s, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            results.append({
                "filename": s.name,
                "path":     str(s),
                "size_kb":  round(s.stat().st_size / 1024, 1),
                "thumb_b64": b64[:30000],  # cap at ~30KB base64
            })
        except Exception:
            pass
    return jsonify({"success": True, "snapshots": results, "count": len(results)})


@app.route("/security/log", methods=["GET"])
def get_security_log():
    """Return recent security events."""
    n       = int(request.args.get("n", 50))
    events  = _load_security_log()
    return jsonify({"success": True, "events": events[-n:], "total": len(events)})


@app.route("/security/lock_now", methods=["POST"])
def lock_now():
    """Manually lock PC immediately."""
    ok = _lock_pc()
    if ok:
        state["pc_locked"] = True
        _append_log("MANUAL_LOCK", "PC manually locked via API.")
    return jsonify({"success": ok, "message": "PC locked, sir." if ok else "Lock command failed."})


@app.route("/security/test_intruder", methods=["POST"])
def test_intruder():
    """Debug endpoint: manually trigger an intruder alert (uses last frame or blank)."""
    with _frame_lock:
        frame = _last_frame.copy() if _last_frame is not None else None
    if frame is None and CV2_OK:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "TEST INTRUDER", (80, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)
    if frame is not None:
        _trigger_intruder_response(frame)
        return jsonify({"success": True, "message": "Test intruder alert triggered."})
    return jsonify({"success": False, "error": "No frame available."})


@app.route("/security/video_feed")
def video_feed():
    """MJPEG stream for the frontend HUD."""
    def generate():
        while True:
            frame_to_send = None
            with _frame_lock:
                if _last_frame is not None:
                    try:
                        # Resize for stream efficiency
                        small = cv2.resize(_last_frame, (480, 270))
                        ret, jpeg = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 70])
                        if ret:
                            frame_to_send = jpeg.tobytes()
                    except Exception:
                        pass

            if frame_to_send:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_to_send + b'\r\n\r\n')
            else:
                # Fallback "Standby" or "Signal Lost" frame if no camera frame available
                try:
                    blank = np.zeros((270, 480, 3), dtype=np.uint8)
                    cv2.putText(blank, "SIGNAL LOST", (140, 135),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    _, jpeg = cv2.imencode('.jpg', blank)
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n\r\n')
                except Exception:
                    pass
            
            time.sleep(0.1)  # 10 FPS
    return app.response_class(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":            "ok",
        "service":           "zaire-face-security",
        "face_lock_enabled": state["face_lock_enabled"],
        "camera_ok":         state["camera_ok"],
        "master_present":    state["master_present"],
        "cv2":               CV2_OK,
        "face_recognition":  FR_OK,
    })


# ─── Startup: auto-start vision loop if master face already registered ────────

def _auto_start():
    """If master_face.jpg already exists, start vision loop immediately."""
    if MASTER_FACE_PATH.exists() and CV2_OK and FR_OK:
        _log("Master face found on startup — auto-starting vision loop.")
        state["face_lock_enabled"] = True
        t = threading.Thread(target=_vision_loop, daemon=True)
        t.start()
    else:
        _log("Standby. Call /security/register to enable Face-Lock.")


# ─────────────────────────── ENTRY POINT ─────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n══════════════════════════════════════════════════════")
    print("  ZAIRE Face Security Daemon")
    print(f"  Flask server on port 3011")
    print(f"  Lock delay:  {ABSENT_LOCK_SECONDS}s | Camera: {CAMERA_INDEX}")
    print(f"  cv2={CV2_OK}  face_recognition={FR_OK}")
    print("══════════════════════════════════════════════════════\n")

    # Auto-start vision if master face exists
    threading.Timer(2.0, _auto_start).start()

    app.run(host="127.0.0.1", port=3011, debug=False, use_reloader=False, threaded=True)
