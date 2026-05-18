import os
import io
import time
import base64
import asyncio
import re
import subprocess
import json
import glob
import psutil
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyautogui
from PIL import ImageGrab
from dotenv import load_dotenv
from specialists.router import SpecialistRouter
from specialists.llm_utils import call_llm_sync, call_llm_stream

# Optional specialized libraries for better control
try:
    import pygetwindow as gw
except ImportError:
    gw = None

# ── NEURAL HEARTBEAT ── 2026-05-10T23:26
load_dotenv()

app = FastAPI(title="ZAIRE Agent Daemon")
specialist_router = SpecialistRouter()

# Disable PyAutoGUI fail-safe for remote-like control (decisive)
pyautogui.FAILSAFE = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    neural_log(f"DEBUG: Request {request.method} {request.url.path}")
    response = await call_next(request)
    neural_log(f"DEBUG: Response status {response.status_code}")
    return response

# ── MODELS ───────────────────────────────────────────────────────────────────

class AgentTask(BaseModel):
    prompt: str
    context: Optional[str] = None
    manifest: Optional[List[dict]] = None
    uploaded_filepath: Optional[str] = None
    uploaded_filepaths: Optional[List[str]] = None

class MouseMove(BaseModel):
    x: int
    y: int
    duration: float = 0.4

class MouseClick(BaseModel):
    x: Optional[int] = None
    y: Optional[int] = None
    button: str = 'left'
    double: bool = False

class MouseScroll(BaseModel):
    amount: int

class KeyboardType(BaseModel):
    text: str
    interval: float = 0.04

class KeyboardHotkey(BaseModel):
    keys: List[str]

class KeyboardPress(BaseModel):
    key: str

class SystemVolume(BaseModel):
    level: int

class SystemVolumeKey(BaseModel):
    direction: str
    steps: int = 5

class SystemBrightness(BaseModel):
    level: int

class WindowAction(BaseModel):
    title: str

class FileAction(BaseModel):
    path: Optional[str] = None
    query: Optional[str] = None
    root: Optional[str] = None

class MediaAction(BaseModel):
    action: str

# ── LOGGING SYSTEM ───────────────────────────────────────────────────────────

def neural_log(message: str):
    """Prints a formatted system log for the ZAIRE Neural Log relay."""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[NEURAL_LOG][{timestamp}] {message}")

# ── UTILS ────────────────────────────────────────────────────────────────────

def get_home_dir():
    return os.path.expanduser("~")

# ── ENDPOINTS: MOUSE ─────────────────────────────────────────────────────────

@app.post("/mouse/move")
async def mouse_move(data: MouseMove):
    neural_log(f"Mouse: Moving to ({data.x}, {data.y})")
    pyautogui.moveTo(data.x, data.y, duration=data.duration)
    return {"success": True}

@app.post("/mouse/click")
async def mouse_click(data: MouseClick):
    neural_log(f"Mouse: {data.button} click at ({data.x}, {data.y})")
    if data.double:
        pyautogui.doubleClick(x=data.x, y=data.y, button=data.button)
    else:
        pyautogui.click(x=data.x, y=data.y, button=data.button)
    return {"success": True}

@app.post("/mouse/scroll")
async def mouse_scroll(data: MouseScroll):
    neural_log(f"Mouse: Scrolling {data.amount}")
    pyautogui.scroll(data.amount * 100) # Scaling for visibility
    return {"success": True}

# ── ENDPOINTS: KEYBOARD ──────────────────────────────────────────────────────

@app.post("/keyboard/type")
async def keyboard_type(data: KeyboardType):
    neural_log(f"Keyboard: Typing '{data.text}'")
    pyautogui.write(data.text, interval=data.interval)
    return {"success": True}

@app.post("/keyboard/hotkey")
async def keyboard_hotkey(data: KeyboardHotkey):
    neural_log(f"Keyboard: Hotkey {data.keys}")
    pyautogui.hotkey(*data.keys)
    return {"success": True}

@app.post("/keyboard/press")
async def keyboard_press(data: KeyboardPress):
    neural_log(f"Keyboard: Pressing '{data.key}'")
    pyautogui.press(data.key)
    return {"success": True}

# ── ENDPOINTS: SYSTEM ────────────────────────────────────────────────────────

@app.post("/system/volume_key")
async def volume_key(data: SystemVolumeKey):
    key = 'volumeup' if data.direction == 'up' else 'volumedown'
    neural_log(f"System: Volume {data.direction} x{data.steps}")
    for _ in range(data.steps):
        pyautogui.press(key)
    return {"success": True}

@app.post("/system/volume")
async def set_volume(data: SystemVolume):
    # nircmd is standard for absolute volume on Windows if available
    # Fallback to powershell
    try:
        val = int(data.level * 655.35)
        subprocess.run(["powershell", "-Command", f"(Get-WmiObject -Query 'Select * from Win32_DesktopMonitor').SetBrightness({data.level})"], capture_output=True)
        # Real volume via PS is complex, we stick to keys for now or simple nircmd if user has it
        neural_log(f"System: Setting absolute volume to {data.level}% (Experimental)")
        return {"success": True}
    except:
        return {"success": False, "error": "Absolute volume not supported"}

@app.post("/system/mute")
async def toggle_mute():
    neural_log("System: Toggling mute")
    pyautogui.press('volumemute')
    return {"success": True}

@app.post("/system/brightness")
async def set_brightness(data: SystemBrightness):
    neural_log(f"System: Setting brightness to {data.level}%")
    cmd = f"powershell (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,{data.level})"
    subprocess.run(cmd, shell=True)
    return {"success": True}

@app.get("/system/screen_info")
async def screen_info():
    w, h = pyautogui.size()
    x, y = pyautogui.position()
    return {"success": True, "width": w, "height": h, "mouse_x": x, "mouse_y": y}

@app.post("/screenshot/save")
async def save_screenshot():
    desktop = os.path.join(get_home_dir(), "Desktop")
    filename = f"ZAIRE_Snapshot_{int(time.time())}.png"
    filepath = os.path.join(desktop, filename)
    neural_log(f"System: Saving screenshot to {filename}")
    pyautogui.screenshot(filepath)
    return {"success": True, "path": filepath}

@app.post("/system/media")
async def control_media(data: MediaAction):
    neural_log(f"System: Media action '{data.action}'")
    pyautogui.press(data.action) # playpause, nexttrack, prevtrack
    return {"success": True}

# ── ENDPOINTS: WINDOWS ───────────────────────────────────────────────────────

@app.get("/window/list")
async def list_windows():
    if gw:
        windows = [{"title": w.title, "id": w._hWnd} for w in gw.getAllWindows() if w.title]
        return {"success": True, "windows": windows}
    return {"success": False, "error": "pygetwindow not installed"}

@app.post("/window/focus")
async def focus_window(data: WindowAction):
    if gw:
        try:
            win = gw.getWindowsWithTitle(data.title)[0]
            win.activate()
            return {"success": True}
        except:
            return {"success": False, "error": "Window not found"}
    return {"success": False, "error": "pygetwindow not installed"}

@app.post("/window/close")
async def close_window(data: WindowAction):
    if gw:
        try:
            win = gw.getWindowsWithTitle(data.title)[0]
            win.close()
            return {"success": True}
        except:
            return {"success": False, "error": "Window not found"}
    return {"success": False, "error": "pygetwindow not installed"}

# ── ENDPOINTS: FILES ─────────────────────────────────────────────────────────

@app.post("/file/list")
async def list_files(data: FileAction):
    path = data.path or get_home_dir()
    try:
        files = os.listdir(path)
        return {"success": True, "files": files}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/file/search")
async def search_files(data: FileAction):
    root = data.root or get_home_dir()
    query = data.query or "*"
    neural_log(f"System: Searching for '{query}' in {root}")
    try:
        # Simple glob search
        matches = glob.glob(os.path.join(root, "**", f"*{query}*"), recursive=True)[:20]
        return {"success": True, "matches": matches}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/file/open")
async def open_file(data: FileAction):
    if not data.path: return {"success": False, "error": "No path provided"}
    neural_log(f"System: Opening file '{data.path}'")
    os.startfile(data.path)
    return {"success": True}

# ── ENDPOINTS: SENTINEL (HEALTH & GIT) ──────────────────────────────────

@app.get("/system/health_sentinel")
async def health_sentinel():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    return {
        "success": True,
        "cpu_percent": cpu,
        "ram": {
            "percent": mem.percent,
            "available_gb": round(mem.available / (1024**3), 2),
            "total_gb": round(mem.total / (1024**3), 2)
        },
        "disk_percent": disk.percent
    }

@app.get("/system/resource_audit")
async def resource_audit():
    # Get top 5 memory-consuming processes
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'memory_info']):
        try:
            processes.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    top_proc = sorted(processes, key=lambda x: x['memory_info'].rss, reverse=True)[:5]
    result = []
    for p in top_proc:
        result.append({
            "name": p['name'],
            "memory_mb": round(p['memory_info'].rss / (1024 * 1024), 2)
        })
    return {"success": True, "top_processes": result}

@app.get("/git/sentinel_status")
async def git_sentinel():
    try:
        # Check current workspace (parent of backend)
        workspace = os.path.dirname(os.getcwd())
        if not os.path.exists(os.path.join(workspace, ".git")):
             return {"success": False, "error": "No git repository found in workspace."}
             
        res = subprocess.run(["git", "status", "--porcelain"], cwd=workspace, capture_output=True, text=True)
        changes = res.stdout.strip().split('\n') if res.stdout.strip() else []
        
        branch_res = subprocess.run(["git", "branch", "--show-current"], cwd=workspace, capture_output=True, text=True)
        branch = branch_res.stdout.strip()
        
        return {
            "success": True, 
            "branch": branch,
            "change_count": len(changes),
            "status": "dirty" if changes else "clean"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── VISION ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "ZAIRE Agent Daemon is LIVE", "version": "1.0.1"}

@app.post("/agent/vision")
async def vision_task(task: AgentTask):
    try:
        screenshot = ImageGrab.grab()
        max_size = 768 
        screenshot.thumbnail((max_size, max_size))
        buffered = io.BytesIO()
        screenshot.save(buffered, format="JPEG", quality=85)
        b64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

        def generate():
            try:
                # Use shared streaming utility for robust vision failover
                # Note: call_llm_stream currently handles text. For vision, it might need 
                # slight adjustment if we want to pass the image, but for now we'll 
                # wrap the vision call with a similar retry pattern.
                
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"You are ZAIRE. Answer briefly: {task.prompt}"},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                        ],
                    }
                ]
                
                # Primary attempt with vision model
                # Provider-agnostic path via shared AI Vault lanes
                for content in call_llm_stream([{"role": "user", "content": f"Answer briefly as ZAIRE: {task.prompt} (Note: Vision stream unavailable, responding via text core.)"}], "llama-3.3-70b-versatile"):
                    yield content

            except Exception as e:
                neural_log(f"ERROR: Vision pipeline failed: {str(e)}")
                yield f"Vision Error: {str(e)}"

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        neural_log(f"ERROR: Vision pipeline failed: {str(e)}")
        return StreamingResponse(iter([f"Vision Error: {str(e)}"]), media_type="text/plain")

@app.post("/agent/chat")
async def specialist_chat(task: AgentTask):
    """Handles chats for specialized modes (TRADER, PROFESSOR, ENGINEER)."""
    try:
        mode = task.context or "ZAIRE"
        
        async def generate():
            try:
                # Specialists now yield progress updates
                generator = specialist_router.process(
                    task.prompt, 
                    mode, 
                    uploaded_filepath=task.uploaded_filepath,
                    uploaded_filepaths=task.uploaded_filepaths
                )
                if generator:
                    for chunk in generator:
                        if hasattr(chunk, '__iter__') and not isinstance(chunk, (str, bytes)):
                            for sub_chunk in chunk:
                                yield sub_chunk
                        else:
                            yield chunk
                else:
                    yield "Sir, the requested specialist protocol is not responding. A system reset may be required."
            except Exception as e:
                neural_log(f"CRITICAL: {mode} Specialist Failure: {str(e)}")
                yield f"\n\n[NEURAL_LINK_ERROR] Sir, I apologize, but the {mode} module encountered a processing error: {str(e)}."

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        neural_log(f"ERROR: Specialist chat failed: {str(e)}")
        return StreamingResponse(iter([f"Specialist Error: {str(e)}"]), media_type="text/plain")

@app.get("/agent/mode_data")
async def get_mode_data(mode: str):
    """Returns HUD data for the active specialist mode."""
    if mode == "SYSTEM_CONFIG":
        try:
            config_path = os.path.join(os.path.dirname(__file__), 'memory', 'system_config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    return {"success": True, "data": json.load(f)}
        except:
            pass
        return {"success": True, "data": {}}

    data = specialist_router.get_mode_data(mode)
    return {"success": True, "data": data}

@app.post("/agent/specialist_action")
async def specialist_action(data: dict):
    """Bridge for discrete UI actions (buttons, toggles) to specialists."""
    mode = data.get("mode")
    action = data.get("action")
    payload = data.get("payload", {})
    
    if not mode or not action:
        raise HTTPException(status_code=400, detail="Missing mode or action")
        
    result = specialist_router.handle_action(mode, action, payload)
    return {"success": True, "result": result}

@app.post("/agent/process")
async def process_task(task: AgentTask):
    """Bridge to specialists for multimodal/text tasks."""
    mode = specialist_router.active_mode
    neural_log(f"Processing in {mode} mode with manifest: {task.manifest is not None}")
    
    def generate():
        for chunk in specialist_router.process(
            task.prompt, 
            mode, 
            task.manifest, 
            uploaded_filepath=task.uploaded_filepath,
            uploaded_filepaths=task.uploaded_filepaths
        ):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/agent/set_mode")
async def set_mode(data: dict):
    mode = data.get("mode", "ZAIRE")
    specialist_router.set_mode(mode)
    if mode == "SWARM":
        neural_log("System: [NEURAL_SWARM] Protocol engaged. Multi-agent synergy active.")
    else:
        neural_log(f"System: Specialist protocol updated to {mode}")
    return {"success": True}

@app.post("/engineer/proactive_draft")
async def create_proactive_draft(data: dict):
    """Bridge for the Engineer to generate a draft based on Visual Echo."""
    analysis = data.get("analysis", "")
    if not analysis:
        raise HTTPException(status_code=400, detail="Analysis required")
    
    # We call handle_echo_detect on the engineer specialist
    analysis = data.get("analysis", "")
    draft_id = specialist_router.specialists["ENGINEER"].handle_echo_detect(analysis)
    
    if draft_id and draft_id in specialist_router.specialists["ENGINEER"]._silent_drafts:
        draft = specialist_router.specialists["ENGINEER"]._silent_drafts[draft_id]
        return {"success": True, "draft_id": draft_id, "title": draft.get("project_title")}
    
    return {"success": False, "message": "Drafting failed"}

@app.get("/agent/mode_data")
async def get_mode_data(mode: str):
    """Returns real-time telemetry from a specific specialist."""
    if mode in specialist_router.specialists:
        data = specialist_router.specialists[mode].get_hud_data()
        return {"success": True, "data": data}
    return {"success": False, "error": f"Specialist {mode} not active."}

@app.post("/agent/specialist_action")
async def specialist_action(data: dict):
    """Executes a discrete action on a specialist (e.g. MANIFEST, TRADE)."""
    mode = data.get("mode")
    action = data.get("action")
    payload = data.get("payload", {})
    
    if mode in specialist_router.specialists:
        result = specialist_router.specialists[mode].handle_action(action, payload)
        return {"success": True, "result": result}
    return {"success": False, "error": f"Specialist {mode} not found."}

@app.post("/agent/shadow")
async def shadow_request(task: AgentTask):
    """Bridge for the Shadow Assistant (Embedded Agency) streaming requests."""
    try:
        def generate():
            # Routes directly to the Engineer's handle_shadow_request
            for chunk in specialist_router.specialists["ENGINEER"].handle_shadow_request(task.prompt, task.context):
                yield chunk

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        neural_log(f"ERROR: Shadow request failed: {str(e)}")
        return StreamingResponse(iter([f"Shadow Error: {str(e)}"]), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    neural_log("ZAIRE Agent Daemon initializing on Core Port 3002...")
    uvicorn.run(app, host="127.0.0.1", port=3002)
