import os
import time
import threading
import tkinter as tk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
import numpy as np

# Graceful library checks
try:
    import cv2
except ImportError:
    cv2 = None
    print("[OBSERVER] Warning: OpenCV (cv2) not found. Vision will be disabled.")

try:
    import face_recognition
except ImportError:
    face_recognition = None
    print("[OBSERVER] Warning: face_recognition not found. Identification disabled.")

app = FastAPI(title="ZAIRE Observer Daemon")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
PRESENCE_STATE = {"detected": False, "name": "Unknown", "emotion": "Neutral", "missing_count": 0}
LAST_RAW_FRAME = None
MASTER_ENCODING = None
FRAME_LOCK = threading.Lock()

# --- HUD OVERLAY (tkinter) ---
class ZAIREOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ZAIRE HUD")
        
        # Transparent always-on-top window
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-transparentcolor", "black")
        self.root.geometry("400x40+20+20") # Top left floating bar
        
        self.canvas = tk.Canvas(self.root, width=400, height=40, bg="black", highlightthickness=0)
        self.canvas.pack()
        
        # HUD Text
        self.status_text = self.canvas.create_text(130, 20, text="ZAIRE STATUS: ONLINE", 
                                                fill="#00ffff", font=("Courier", 10, "bold"))
        self.cam_text = self.canvas.create_text(40, 20, text="CAM: OK", 
                                                fill="#00ff00", font=("Courier", 8))
        
        # --- HUD Elements ---
        self.reg_btn = tk.Button(self.root, text="REGISTER FACE", command=self.on_register,
                               bg="#1a1a1a", fg="#00ffff", font=("Courier", 8),
                               borderwidth=1, relief="flat")
        self.reg_btn.place(x=300, y=10)
        
        self.update_hud()
        
    def on_register(self):
        try:
            import requests
            res = requests.post("http://127.0.0.1:3003/register")
            print(res.json())
        except Exception as e:
            print(f"Registration failed: {e}")
        
    def update_hud(self):
        label = "ZAIRE | "
        if PRESENCE_STATE["detected"]:
            label += f"USER: {PRESENCE_STATE['name']} | EMOTION: {PRESENCE_STATE['emotion']}"
        else:
            label += "USER: ABSENT | STANDBY"
            
        self.canvas.itemconfig(self.status_text, text=label)
        self.root.after(1000, self.update_hud)

    def run(self):
        self.root.mainloop()

# --- VISION THREAD (Advanced Recognition) ---
def vision_loop():
    global LAST_RAW_FRAME, MASTER_ENCODING
    if cv2 is None or face_recognition is None:
        print("[VISION] Standing by. Dependencies not ready yet.")
        return
        
    cap = cv2.VideoCapture(0)
    
    while True:
        # Reload master encoding if it exists and we don't have it
        if MASTER_ENCODING is None and os.path.exists("master_face.jpg"):
            try:
                raw_img = cv2.imread("master_face.jpg")
                if raw_img is not None:
                    rgb_img = cv2.cvtColor(raw_img, cv2.COLOR_BGR2RGB)
                    # Force C-contiguous uint8
                    rgb_img = np.ascontiguousarray(rgb_img, dtype=np.uint8)
                    encodings = face_recognition.face_encodings(rgb_img)
                    if encodings:
                        MASTER_ENCODING = encodings[0]
                        print("[VISION] Master biometric signature loaded.")
            except Exception as e:
                print(f"[VISION] Failed to load master face: {e}")

        ret, frame = cap.read()
        if not ret or frame is None:
            PRESENCE_STATE["missing_count"] += 1
            if PRESENCE_STATE["missing_count"] % 5 == 0:
                 print(f"[VISION] Warning: Camera signal lost ({PRESENCE_STATE['missing_count']} frames). Resetting sensor...")
                 cap.release()
                 time.sleep(1)
                 cap = cv2.VideoCapture(0)
            
            if PRESENCE_STATE["missing_count"] >= 15:
                if PRESENCE_STATE["detected"]:
                    print("[VISION] Absence confirmed after extended signal loss.")
                    PRESENCE_STATE["detected"] = False
                    PRESENCE_STATE["name"] = "Unknown"
            
            time.sleep(1)
            continue
        
        # Reset heartbeat on valid frame
        PRESENCE_STATE["missing_count"] = 0
            
        # --- MOTION DETECTION PRE-FILTER ---
        # Only run recognition if motion is detected to save CPU and reduce lag
        has_movement = True
        try:
            if LAST_RAW_FRAME is not None:
                prev_gray = cv2.cvtColor(LAST_RAW_FRAME, cv2.COLOR_BGR2GRAY)
                curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                frame_diff = cv2.absdiff(prev_gray, curr_gray)
                _, thresh = cv2.threshold(frame_diff, 25, 255, cv2.THRESH_BINARY)
                motion_pixels = np.sum(thresh)
                # If very low movement, skip recognition (threshold adjustable)
                if motion_pixels < 5000:
                    has_movement = False
        except Exception:
            has_movement = True # Fallback to detection if diff fails

        with FRAME_LOCK:
            LAST_RAW_FRAME = frame.copy()
            
        if not has_movement and PRESENCE_STATE["detected"]:
            # If user was already detected and there's no movement, keep them detected but skip heavy AI
            time.sleep(1.5)
            continue

        try:
            # 1. Resize and ensure 3-channel (Increased to 0.5x for better detection)
            small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            if len(small_frame.shape) == 2:
                 small_frame = cv2.cvtColor(small_frame, cv2.COLOR_GRAY2BGR)
            
            # 2. Force RGB and uint8 C-contiguous
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame = np.ascontiguousarray(rgb_frame, dtype=np.uint8)
            rgb_small_frame = np.ascontiguousarray(rgb_small_frame, dtype=np.uint8)
            
            # 3. Final verification of input
            if rgb_small_frame.size == 0 or rgb_small_frame.dtype != np.uint8 or len(rgb_small_frame.shape) != 3:
                 continue
                 
            face_locations = face_recognition.face_locations(rgb_small_frame)
            if len(face_locations) > 0:
                print(f"[VISION] Debug: Found {len(face_locations)} potential faces...")
        except Exception as vision_err:
            # More detailed crash report
            print(f"[VISION] Core recognition error: {vision_err}")
            if 'rgb_small_frame' in locals():
                 print(f"DEBUG: shape={rgb_small_frame.shape}, dtype={rgb_small_frame.dtype}")
            time.sleep(2)
            continue
        
        if len(face_locations) > 0:
            # Reset missing count on ANY face detection
            PRESENCE_STATE["missing_count"] = 0
            
            # --- HIGH-RES IDENTIFICATION ---
            # Map low-res coordinates back to full-res frame for better biometric detail
            high_res_locations = [(t*2, r*2, b*2, l*2) for (t,r,b,l) in face_locations]
            
            name = "Unknown"
            if MASTER_ENCODING is not None:
                # Encode on the full-resolution frame
                face_encodings = face_recognition.face_encodings(rgb_frame, high_res_locations)
                for face_encoding in face_encodings:
                    # Tolerance 0.6 is industry standard for stable matching
                    matches = face_recognition.compare_faces([MASTER_ENCODING], face_encoding, tolerance=0.6)
                    if True in matches:
                        name = "Master"
                        break
            
            if not PRESENCE_STATE["detected"] or PRESENCE_STATE["name"] != name:
                print(f"[VISION] {name} detected!")
                PRESENCE_STATE["detected"] = True
                PRESENCE_STATE["name"] = name
                
                # Notify Backend in Background Thread (Non-blocking)
                def send_detect():
                    try:
                        import requests
                        backend_user = "Master" if name == "Master" else "Unknown"
                        requests.post("http://127.0.0.1:3001/presence", 
                                      json={"status": "detected", "user": backend_user}, 
                                      timeout=2)
                    except: pass
                threading.Thread(target=send_detect, daemon=True).start()

            elif name == "Unknown" and PRESENCE_STATE["name"] == "Master":
                 # Face found but NOT recognized as Master
                 print("[VISION] Warning: Face detected but identification failed.")
        else:
            # Increment missing count
            PRESENCE_STATE["missing_count"] += 1
            
            # Only trigger absence if missing for 7+ consecutive frames (~10.5s)
            if PRESENCE_STATE["detected"] and PRESENCE_STATE["missing_count"] >= 7:
                print(f"[VISION] Absence confirmed after {PRESENCE_STATE['missing_count']} missed frames.")
                
                # Notify Backend in Background Thread (Non-blocking)
                def send_absent():
                    try:
                        import requests
                        requests.post("http://127.0.0.1:3001/presence", 
                                      json={"status": "absent", "user": "Unknown"}, 
                                      timeout=2)
                    except: pass
                threading.Thread(target=send_absent, daemon=True).start()

                PRESENCE_STATE["detected"] = False
                PRESENCE_STATE["name"] = "Unknown"
            elif not PRESENCE_STATE["detected"]:
                PRESENCE_STATE["name"] = "Unknown"
            
        time.sleep(1.0) # Poll every 1 second for better responsiveness

# --- API ENDPOINTS ---
@app.get("/status")
def get_status():
    return PRESENCE_STATE

@app.post("/register")
def register_face():
    """Saves the last captured frame as master_face.jpg, ensuring a face is present."""
    global MASTER_ENCODING
    if cv2 is None or face_recognition is None:
        return {"status": "error", "message": "Vision core not fully initialized"}
    
    with FRAME_LOCK:
        if LAST_RAW_FRAME is not None:
            # Verification: Does the frame actually have a face?
            small = cv2.resize(LAST_RAW_FRAME, (0, 0), fx=0.5, fy=0.5)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            faces = face_recognition.face_locations(rgb_small)
            
            if len(faces) == 0:
                 return {"status": "error", "message": "Sir, I don't see anyone in the frame. Please look at the camera."}
            
            cv2.imwrite("master_face.jpg", LAST_RAW_FRAME)
            MASTER_ENCODING = None # Force reload in vision_loop
            print("[OBSERVER] Master face registered from high-res frame.")
            return {"status": "success", "message": "Biometric signature updated, sir. I have you in my database now."}
    
    return {"status": "error", "message": "No stable camera feed detected."}

@app.post("/hud/message")
def post_hud_message(msg: str):
    # This would need a way to communicate back to the tkinter loop
    pass

if __name__ == "__main__":
    # Start vision thread
    threading.Thread(target=vision_loop, daemon=True).start()
    
    # Start HUD in separate thread (tkinter needs main thread usually, so we run FastAPI as daemon)
    overlay = ZAIREOverlay()
    
    config = uvicorn.Config(app, port=3003, log_level="info")
    server = uvicorn.Server(config)
    
    threading.Thread(target=server.run, daemon=True).start()
    
    overlay.run()
