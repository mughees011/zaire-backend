'''Neural Attention Monitor – tracks eye gaze direction and blink rate during study sessions.
Publishes events via EventBus for the HUD to display alerts (voice flash, etc.).
'''

import os
import sys
import time
import threading
import base64
from datetime import datetime
from pathlib import Path

# Third‑party libs
import cv2
import numpy as np

# MediaPipe for facial landmarks (eye aspect ratio)
try:
    import mediapipe as mp
except ImportError:
    print('[ATTENTION] mediapipe not installed – install with "pip install mediapipe"')
    sys.exit(1)

# Event bus for intra‑process communication
from backend.event_bus import EventBus

# ---------------------------------------------------------------------------
# Configuration – read from env or defaults (can be overridden via config.py)
# ---------------------------------------------------------------------------
CAMERA_INDEX = int(os.getenv('ATTENTION_CAMERA_INDEX', '0'))
GAZE_OFF_THRESHOLD = float(os.getenv('ATTENTION_GAZE_OFF_SECONDS', '30'))  # seconds
BLINK_RATE_THRESHOLD = float(os.getenv('ATTENTION_BLINK_RATE', '20'))      # blinks per minute

# ---------------------------------------------------------------------------
# Helper functions for eye aspect ratio (blink detection)
# ---------------------------------------------------------------------------
mp_face_mesh = mp.solutions.face_mesh
FACE_MESH = mp_face_mesh.FaceMesh(static_image_mode=False,
                                 max_num_faces=1,
                                 refine_landmarks=True,
                                 min_detection_confidence=0.5,
                                 min_tracking_confidence=0.5)

# Indices for left and right eye landmarks (MediaPipe)
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

def _eye_aspect_ratio(landmarks, eye_idxs):
    # Compute EAR based on vertical and horizontal distances
    p = [landmarks[i] for i in eye_idxs]
    # Convert normalized landmarks to pixel space later – handled outside
    # Here we just compute using the provided (x, y) tuples
    # EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
    # Using indices order from MediaPipe docs (approx)
    # For simplicity, use Euclidean distance
    import math
    def dist(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])
    # vertical distances
    v1 = dist(p[1], p[5])
    v2 = dist(p[2], p[4])
    # horizontal distance
    h = dist(p[0], p[3])
    ear = (v1 + v2) / (2.0 * h) if h != 0 else 0
    return ear

# ---------------------------------------------------------------------------
# Core monitoring thread
# ---------------------------------------------------------------------------
class AttentionMonitor:
    def __init__(self):
        self.bus = EventBus.get_instance()
        self._running = threading.Event()
        self._thread = None
        self.state = {
            'gaze_off_start': None,   # timestamp when gaze left screen
            'blink_times': [],        # timestamps of each blink detected
            'last_frame_time': None,
            'last_alert': None,
        }

    def start(self):
        if self._thread and self._thread.is_alive():
            return {'success': True, 'message': 'Attention monitor already running.'}
        self._running.set()
        self._thread = threading.Thread(target=self._vision_loop, daemon=True)
        self._thread.start()
        # Ensure event bus dispatcher is running
        asyncio_thread = threading.Thread(target=self._ensure_bus_running, daemon=True)
        asyncio_thread.start()
        return {'success': True, 'message': 'Attention monitor started.'}

    def stop(self):
        self._running.clear()
        return {'success': True, 'message': 'Attention monitor stopping.'}

    def _ensure_bus_running(self):
        # Simple check – start bus if not already started
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        async def starter():
            await self.bus.start()
        loop.run_until_complete(starter())

    def _publish_alert(self, reason, detail=None):
        payload = {'reason': reason, 'timestamp': datetime.utcnow().isoformat()}
        if detail is not None:
            payload['detail'] = detail
        # Fire‑and‑forget publish (async)
        import asyncio
        asyncio.run(self.bus.publish('AttentionAlert', payload))
        self.state['last_alert'] = time.time()

    def _process_frame(self, frame):
        # Resize for speed
        small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        results = FACE_MESH.process(rgb)
        h, w = small.shape[:2]
        if not results.multi_face_landmarks:
            return None  # no face detected
        landmarks = results.multi_face_landmarks[0].landmark
        # Convert normalized landmarks to pixel coordinates
        pts = [(int(l.x * w), int(l.y * h)) for l in landmarks]
        # Compute EAR for both eyes
        left_ear = _eye_aspect_ratio(pts, LEFT_EYE)
        right_ear = _eye_aspect_ratio(pts, RIGHT_EYE)
        ear = (left_ear + right_ear) / 2.0
        # Simple blink detection: EAR below threshold (0.2) indicates blink
        blinked = ear < 0.22
        if blinked:
            self.state['blink_times'].append(time.time())
        # Gaze direction – approximate by eye center vs face center
        # Use nose tip as proxy for face center (landmark 1)
        nose = pts[1]
        left_eye_center = pts[LEFT_EYE[0]]
        right_eye_center = pts[RIGHT_EYE[0]]
        eye_center = ((left_eye_center[0] + right_eye_center[0]) // 2,
                     (left_eye_center[1] + right_eye_center[1]) // 2)
        # Vector from nose to eye_center
        dx = eye_center[0] - nose[0]
        dy = eye_center[1] - nose[1]
        # Assume screen center at image center
        screen_center = (w // 2, h // 2)
        gaze_dx = eye_center[0] - screen_center[0]
        gaze_dy = eye_center[1] - screen_center[1]
        # Simple metric: if gaze offset > 40 pixels in any direction, consider looking away
        gaze_off = abs(gaze_dx) > 40 or abs(gaze_dy) > 40
        return {'blinked': blinked, 'gaze_off': gaze_off}

    def _vision_loop(self):
        cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
        if not cap.isOpened():
            print(f'[ATTENTION] Cannot open camera {CAMERA_INDEX}')
            return
        while self._running.is_set():
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.2)
                continue
            now = time.time()
            self.state['last_frame_time'] = now
            result = self._process_frame(frame)
            if result is None:
                # No face – treat as gaze off
                result = {'blinked': False, 'gaze_off': True}
            # Gaze off handling
            if result['gaze_off']:
                if self.state['gaze_off_start'] is None:
                    self.state['gaze_off_start'] = now
                elif now - self.state['gaze_off_start'] >= GAZE_OFF_THRESHOLD:
                    # Trigger alert if not already recent
                    if not self.state['last_alert'] or now - self.state['last_alert'] > GAZE_OFF_THRESHOLD:
                        self._publish_alert('gaze_off', {'duration': now - self.state['gaze_off_start']})
                        self.state['gaze_off_start'] = now  # reset after alert
            else:
                self.state['gaze_off_start'] = None
            # Blink rate handling (blinks per minute)
            # Prune old blink timestamps (>60 sec)
            one_min_ago = now - 60
            self.state['blink_times'] = [t for t in self.state['blink_times'] if t >= one_min_ago]
            blink_rate = len(self.state['blink_times'])  # per minute
            if blink_rate >= BLINK_RATE_THRESHOLD:
                # Alert for drowsiness
                if not self.state['last_alert'] or now - self.state['last_alert'] > 30:
                    self._publish_alert('high_blink_rate', {'rate_per_min': blink_rate})
                    self.state['last_alert'] = now
            time.sleep(0.05)  # ~20 FPS loop
        cap.release()
        print('[ATTENTION] Vision loop stopped.')

# ---------------------------------------------------------------------------
# Flask API – thin wrapper around the monitor
# ---------------------------------------------------------------------------
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
monitor = AttentionMonitor()

@app.route('/attention/start', methods=['POST'])
def start_monitor():
    res = monitor.start()
    return jsonify(res)

@app.route('/attention/stop', methods=['POST'])
def stop_monitor():
    res = monitor.stop()
    return jsonify(res)

@app.route('/attention/status', methods=['GET'])
def status():
    s = monitor.state.copy()
    # Convert timestamps to readable
    if s.get('gaze_off_start'):
        s['gaze_off_seconds'] = time.time() - s['gaze_off_start']
    s['blink_rate_per_min'] = len(s.get('blink_times', []))
    return jsonify({'success': True, 'state': s})

if __name__ == '__main__':
    # Auto‑start if env flag enabled
    if os.getenv('ATTENTION_AUTO_START', 'true').lower() == 'true':
        monitor.start()
    app.run(host='127.0.0.1', port=3022, debug=False, use_reloader=False, threaded=True)
