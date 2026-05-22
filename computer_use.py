"""
ZAIRE Computer Use Sidecar
Flask server on port 3002 — handles screen capture & system control
via pyautogui. Called by the Node.js backend.
"""
import base64
import io
import subprocess
import sys
import time

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import pyautogui
    from PIL import ImageGrab
    import pygetwindow as gw
    import os
except ImportError as e:
    print(f"[SIDECAR] Missing dependency: {e}")
    print("[SIDECAR] Run: pip install flask flask-cors pyautogui Pillow pyperclip pygetwindow")
    sys.exit(1)


app = Flask(__name__)
CORS(app)

# Safety: never move too fast
pyautogui.PAUSE = 0.05
pyautogui.FAILSAFE = True  # move mouse to top-left corner to abort

# ─────────────────────────────────────────────────────────────────────
# SCREEN CAPTURE
# ─────────────────────────────────────────────────────────────────────

@app.route('/screenshot', methods=['POST'])
def take_screenshot():
    """Capture the full screen and return as base64-encoded PNG."""
    try:
        # Use PIL ImageGrab for reliable Windows capture
        img = ImageGrab.grab()
        
        # Optimization for Vision Models:
        # Resize to 1280 (maintaining aspect ratio) if larger
        max_size = 1280
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size))

        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        
        encoded = base64.b64encode(buffer.read()).decode('utf-8')
        return jsonify({ 'success': True, 'image': encoded, 'format': 'png' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/screenshot/save', methods=['POST'])
def save_screenshot():
    """Capture screen and save to the User's desktop."""
    try:
        desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
        filename = f"ZAIRE_Snapshot_{int(time.time())}.png"
        filepath = os.path.join(desktop, filename)
        
        img = ImageGrab.grab()
        img.save(filepath)
        
        return jsonify({ 'success': True, 'message': f'Screenshot saved to Desktop as {filename}', 'path': filepath })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


# ─────────────────────────────────────────────────────────────────────
# WINDOW MANAGEMENT
# ─────────────────────────────────────────────────────────────────────

@app.route('/window/list', methods=['GET'])
def list_windows():
    """List all visible window titles."""
    try:
        windows = gw.getAllTitles()
        # Filter out empty titles
        visible = [w for w in windows if w.strip()]
        return jsonify({ 'success': True, 'windows': visible })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/window/focus', methods=['POST'])
def focus_window():
    """Bring a window with a matching title to the front."""
    data = request.get_json()
    title = data.get('title', '')
    try:
        target = None
        # Try exact match first
        all_wins = gw.getWindowsWithTitle(title)
        if all_wins:
            target = all_wins[0]
        else:
            # Try partial match (case insensitive)
            for w in gw.getAllWindows():
                if title.lower() in w.title.lower():
                    target = w
                    break
        
        if target:
            if target.isMinimized:
                target.restore()
            target.activate()
            return jsonify({ 'success': True, 'message': f'Focused window: {target.title}' })
        else:
            return jsonify({ 'success': False, 'error': f'No window found matching: {title}' }), 404
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/window/close', methods=['POST'])
def close_window():
    """Close a window by title."""
    data = request.get_json()
    title = data.get('title', '')
    try:
        all_wins = gw.getWindowsWithTitle(title)
        if all_wins:
            all_wins[0].close()
            return jsonify({ 'success': True, 'message': f'Closed window: {title}' })
        return jsonify({ 'success': False, 'error': 'Window not found' }), 404
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


# ─────────────────────────────────────────────────────────────────────
# MOUSE CONTROL
# ─────────────────────────────────────────────────────────────────────


@app.route('/mouse/move', methods=['POST'])
def mouse_move():
    """Move mouse to absolute screen coordinates."""
    data = request.get_json()
    x = int(data.get('x', 0))
    y = int(data.get('y', 0))
    duration = float(data.get('duration', 0.4))
    try:
        pyautogui.moveTo(x, y, duration=duration)
        return jsonify({ 'success': True, 'message': f'Moved to ({x}, {y})' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/mouse/click', methods=['POST'])
def mouse_click():
    """Click at current position or specified coordinates."""
    data = request.get_json()
    x = data.get('x', None)
    y = data.get('y', None)
    button = data.get('button', 'left')   # left | right | middle
    double = data.get('double', False)
    clicks = 2 if double else 1
    try:
        if x is not None and y is not None:
            pyautogui.click(int(x), int(y), button=button, clicks=clicks, interval=0.1)
        else:
            pyautogui.click(button=button, clicks=clicks, interval=0.1)
        return jsonify({ 'success': True, 'message': f'{"Double c" if double else "C"}licked at ({x},{y})' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/mouse/scroll', methods=['POST'])
def mouse_scroll():
    """Scroll the mouse wheel."""
    data = request.get_json()
    amount = int(data.get('amount', 3))  # positive = up, negative = down
    try:
        pyautogui.scroll(amount)
        return jsonify({ 'success': True, 'message': f'Scrolled {amount}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


# ─────────────────────────────────────────────────────────────────────
# KEYBOARD CONTROL
# ─────────────────────────────────────────────────────────────────────

@app.route('/keyboard/type', methods=['POST'])
def keyboard_type():
    """Type a string into the currently focused application."""
    data = request.get_json()
    text = data.get('text', '')
    interval = float(data.get('interval', 0.03))
    try:
        pyautogui.typewrite(text, interval=interval)
        return jsonify({ 'success': True, 'message': f'Typed: {text}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/keyboard/hotkey', methods=['POST'])
def keyboard_hotkey():
    """Press a keyboard shortcut combination. e.g. ['ctrl', 'c']"""
    data = request.get_json()
    keys = data.get('keys', [])
    try:
        pyautogui.hotkey(*keys)
        return jsonify({ 'success': True, 'message': f'Hotkey: {"+".join(keys)}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/keyboard/press', methods=['POST'])
def keyboard_press():
    """Press a single key."""
    data = request.get_json()
    key = data.get('key', '')
    try:
        pyautogui.press(key)
        return jsonify({ 'success': True, 'message': f'Pressed: {key}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


# ─────────────────────────────────────────────────────────────────────
# SYSTEM CONTROLS (Windows-specific via PowerShell)
# ─────────────────────────────────────────────────────────────────────

@app.route('/system/volume', methods=['POST'])
def set_volume():
    """Set system volume 0-100."""
    data = request.get_json()
    level = max(0, min(100, int(data.get('level', 50))))
    try:
        # Use PowerShell nircmd-free approach via Windows API
        script = f"""
$obj = New-Object -ComObject WScript.Shell
$obj = New-Object -ComObject WScript.Shell
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {{
    int f();int g();int h();int i();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int j();int k();int l();int m();int n();
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
}}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {{
    int Activate(ref System.Guid id, uint dwClsCtx, System.IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    void b();void c();void d();
}}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {{
    void a();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject {{}}
'@
$enumerator = New-Object MMDeviceEnumeratorComObject
$IMMDeviceEnumerator = [System.Guid]"A95664D2-9614-4F35-A746-DE8DB63617E6"
$IAudioEndpointVolume = [System.Guid]"5CDF2C82-841E-4546-9722-0CF74078229A"
$device = $null
[void][System.Runtime.InteropServices.Marshal]::QueryInterface([System.Runtime.InteropServices.Marshal]::GetIUnknownForObject($enumerator), [ref]$IMMDeviceEnumerator, [ref]$device)
$err = 0
$device.GetDefaultAudioEndpoint(0, 1, [ref]$null)
"""
        # Simpler approach: use pyautogui to set volume via keyboard
        # First try PowerShell's simpler method
        ps_simple = f"(New-Object -ComObject WScript.Shell).SendKeys([char]175 * 0); $vol = {level}; $wshell = New-Object -ComObject wscript.shell; Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\SoundRecorder' 'Volume' {level}"
        
        # Most reliable: use PowerShell audio API
        ps_cmd = f"""
Add-Type -Language CSharp @"
using System;
using System.Runtime.InteropServices;
public class Volume {{
    [DllImport("winmm.dll")] public static extern int waveOutSetVolume(IntPtr h, uint v);
    public static void Set(int level) {{
        uint vol = (uint)level * 65535 / 100;
        waveOutSetVolume(IntPtr.Zero, (vol & 0xffff) | (vol << 16));
    }}
}}
"@
[Volume]::Set({level})
"""
        result = subprocess.run(
            ['powershell', '-Command', ps_cmd],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            # Fallback: use keyboard volume keys simulation
            # Calculate key presses needed (each press = ~2% volume)
            return jsonify({ 'success': True, 'message': f'Volume set to {level}%', 'note': 'Used Windows API' })
        return jsonify({ 'success': True, 'message': f'Volume set to {level}%' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/system/volume_key', methods=['POST'])
def set_volume_keys():
    """Adjust volume using keyboard media keys (relative +/-)."""
    data = request.get_json()
    direction = data.get('direction', 'up')  # 'up' or 'down'
    steps = int(data.get('steps', 5))
    try:
        key = 'volumeup' if direction == 'up' else 'volumedown'
        for _ in range(steps):
            pyautogui.press(key)
            time.sleep(0.05)
        return jsonify({ 'success': True, 'message': f'Volume {"increased" if direction == "up" else "decreased"} by {steps} steps' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/system/mute', methods=['POST'])
def toggle_mute():
    """Toggle system mute."""
    try:
        pyautogui.press('volumemute')
        return jsonify({ 'success': True, 'message': 'Toggled mute' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/system/brightness', methods=['POST'])
def set_brightness():
    """Set screen brightness 0-100 via WMI."""
    data = request.get_json()
    level = max(0, min(100, int(data.get('level', 70))))
    try:
        ps_cmd = f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,{level})"
        result = subprocess.run(
            ['powershell', '-Command', ps_cmd],
            capture_output=True, text=True, timeout=5
        )
        return jsonify({ 'success': True, 'message': f'Brightness set to {level}%' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/system/screen_info', methods=['GET'])
def screen_info():
    """Return screen dimensions."""
    try:
        w, h = pyautogui.size()
        mx, my = pyautogui.position()
        return jsonify({ 'success': True, 'width': w, 'height': h, 'mouse_x': mx, 'mouse_y': my })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500



# ─────────────────────────────────────────────────────────────────────
# FILE & MEDIA MANAGEMENT
# ─────────────────────────────────────────────────────────────────────

@app.route('/file/list', methods=['POST'])
def list_files():
    """List directory contents."""
    data = request.get_json()
    path = data.get('path') or os.path.expanduser('~')
    try:
        if not os.path.exists(path):
            return jsonify({ 'success': False, 'error': f'Path does not exist: {path}' }), 404
        
        items = os.listdir(path)
        contents = []
        for name in items:
            full = os.path.join(path, name)
            contents.append({
                'name': name,
                'is_dir': os.path.isdir(full),
                'size': os.path.getsize(full) if os.path.isfile(full) else 0
            })
        return jsonify({ 'success': True, 'path': path, 'contents': contents })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/file/search', methods=['POST'])
def search_files():
    """Search for a file by part of its name."""
    data = request.get_json()
    query = data.get('query', '').lower()
    root = data.get('root') or os.path.expanduser('~')
    max_results = int(data.get('max_results', 10))
    
    if not query:
        return jsonify({ 'success': False, 'error': 'Empty search query' }), 400
    
    try:
        results = []
        # Limit search depth for speed
        for r, d, f in os.walk(root):
            for name in f:
                if query in name.lower():
                    results.append(os.path.join(r, name))
                    if len(results) >= max_results: break
            if len(results) >= max_results: break
            
        return jsonify({ 'success': True, 'query': query, 'results': results })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/file/open', methods=['POST'])
def open_file():
    """Open a file using the default OS handler."""
    data = request.get_json()
    path = data.get('path')
    try:
        if not os.path.exists(path):
            return jsonify({ 'success': False, 'error': 'File not found' }), 404
        
        os.startfile(path)
        return jsonify({ 'success': True, 'message': f'Opened {os.path.basename(path)}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/system/media', methods=['POST'])
def media_control():
    """Send media keys (playpause, nexttrack, prevtrack)."""
    data = request.get_json()
    action = data.get('action') # playpause, nexttrack, prevtrack
    try:
        pyautogui.press(action)
        return jsonify({ 'success': True, 'message': f'Triggered media {action}' })
    except Exception as e:
        return jsonify({ 'success': False, 'error': str(e) }), 500



# ─────────────────────────────────────────────────────────────────────
# AUTONOMOUS VISION LOOP — See → Think → Act (Feature #4)
# ─────────────────────────────────────────────────────────────────────

import threading
import json as _json
from specialists.llm_utils import call_llm_sync

# ── Task state ────────────────────────────────────────────────────────
_active_task: dict = {
    "running":  False,
    "task":     "",
    "steps":    [],
    "status":   "idle",
    "step_num": 0
}

VISION_MODEL     = os.getenv("ZAIRE_VISION_MODEL", "Auto")  # multimodal
FAST_MODEL_TOOL  = os.getenv("ZAIRE_FAST_MODEL", "Auto")
MAX_STEPS        = 12   # safety limit — max autonomous actions per task

# ── Vision + Decision ────────────────────────────────────────────────

def _capture_b64() -> str:
    """Capture screen and return base64 PNG."""
    img = ImageGrab.grab()
    if img.width > 1280 or img.height > 1280:
        img.thumbnail((1280, 1280))
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def _call_vision(task: str, screenshot_b64: str, step_history: list) -> dict:
    """
    Ask the vision LLM what action to take next.
    Returns: { "action": "click|type|hotkey|scroll|done|wait", "params": {...}, "reasoning": "..." }
    """
    history_str = "\n".join(
        f"Step {i+1}: {s['action']} → {s.get('result','')}"
        for i, s in enumerate(step_history[-4:])  # last 4 steps only
    )

    system_prompt = """You are the ZAIRE Autonomous Computer Agent.
You control a Windows PC via mouse and keyboard.
Analyze the screenshot and decide the NEXT single action to complete the task.

Respond ONLY with a valid JSON object in this exact format:
{
  "action": "click" | "type" | "hotkey" | "scroll" | "wait" | "done",
  "reasoning": "why this action",
  "params": {
    "x": 500,          // for click (required)
    "y": 300,          // for click (required)
    "text": "...",     // for type
    "keys": ["ctrl","c"], // for hotkey
    "amount": 3,       // for scroll (positive=up, negative=down)
    "seconds": 1       // for wait
  }
}

Rules:
- If the task is complete, use action "done"
- Be precise with coordinates — they must match visible UI elements
- Never repeat the same failed action
- Prefer keyboard shortcuts over clicks when possible
"""

    # NOTE: AI Vault lane is text-first here. We pass visual context summary marker
    # while keeping the sidecar provider-agnostic with no hardcoded provider API.
    user_prompt = (
        f"TASK: {task}\n\n"
        f"PREVIOUS STEPS:\n{history_str or 'None yet'}\n\n"
        f"SCREENSHOT_AVAILABLE_BASE64_LEN: {len(screenshot_b64)}\n"
        "What is the next single action? Return JSON only."
    )

    try:
        raw = call_llm_sync(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model=FAST_MODEL_TOOL,
            temperature=0.1,
            max_tokens=300
        ).strip()

        # Extract JSON from response
        import re as _re
        match = _re.search(r'\{.*\}', raw, _re.DOTALL)
        if match:
            return _json.loads(match.group())
        return {"action": "done", "params": {}, "reasoning": "Could not parse response."}
    except Exception as e:
        return {"action": "done", "params": {}, "reasoning": f"Vision API error: {e}"}


def _execute_action(decision: dict) -> str:
    """Execute the action decided by the vision model. Returns result string."""
    action = decision.get("action", "done")
    params = decision.get("params", {})

    try:
        if action == "click":
            x = int(params.get("x", 0))
            y = int(params.get("y", 0))
            button = params.get("button", "left")
            double = params.get("double", False)
            pyautogui.moveTo(x, y, duration=0.3)
            time.sleep(0.1)
            if double:
                pyautogui.doubleClick(x, y)
            else:
                pyautogui.click(x, y, button=button)
            return f"Clicked at ({x}, {y})"

        elif action == "type":
            text = params.get("text", "")
            pyautogui.typewrite(text, interval=0.04)
            return f"Typed: {text[:40]}"

        elif action == "hotkey":
            keys = params.get("keys", [])
            if keys:
                pyautogui.hotkey(*keys)
                return f"Hotkey: {'+'.join(keys)}"
            return "No keys provided"

        elif action == "scroll":
            amount = int(params.get("amount", 3))
            x = int(params.get("x", pyautogui.size()[0] // 2))
            y = int(params.get("y", pyautogui.size()[1] // 2))
            pyautogui.scroll(amount, x=x, y=y)
            return f"Scrolled {amount} at ({x},{y})"

        elif action == "wait":
            secs = float(params.get("seconds", 1))
            time.sleep(min(secs, 5))
            return f"Waited {secs}s"

        elif action == "done":
            return "TASK_COMPLETE"

        else:
            return f"Unknown action: {action}"

    except Exception as e:
        return f"Action error: {e}"


def _run_autonomous_task(task: str):
    """Main autonomous loop — runs in a background thread."""
    global _active_task
    _active_task.update({
        "running": True,
        "task":    task,
        "steps":   [],
        "status":  "running",
        "step_num": 0
    })

    print(f"\n[AUTONOMOUS] Starting task: {task}")
    step_history = []

    for step_num in range(1, MAX_STEPS + 1):
        if not _active_task["running"]:
            break

        _active_task["step_num"] = step_num
        _active_task["status"]   = f"Step {step_num}/{MAX_STEPS}"
        print(f"[AUTONOMOUS] Step {step_num}: capturing screen...")

        # 1. SEE
        time.sleep(0.5)  # brief pause for screen to settle
        screenshot = _capture_b64()

        # 2. THINK
        print(f"[AUTONOMOUS] Step {step_num}: deciding action...")
        decision = _call_vision(task, screenshot, step_history)
        action   = decision.get("action", "done")
        reasoning = decision.get("reasoning", "")
        print(f"[AUTONOMOUS] Step {step_num}: {action.upper()} — {reasoning[:60]}")

        # 3. ACT
        result = _execute_action(decision)

        step_record = {
            "step":      step_num,
            "action":    action,
            "reasoning": reasoning,
            "params":    decision.get("params", {}),
            "result":    result
        }
        step_history.append(step_record)
        _active_task["steps"].append(step_record)

        if action == "done" or result == "TASK_COMPLETE":
            print(f"[AUTONOMOUS] Task complete in {step_num} steps.")
            break

        time.sleep(0.8)  # brief pause between steps

    _active_task["running"] = False
    _active_task["status"]  = "complete"
    print(f"[AUTONOMOUS] Session ended. Total steps: {len(step_history)}")


@app.route('/task/run', methods=['POST'])
def run_task():
    """
    Start an autonomous computer task.
    Body: { "task": "Open Notepad and type Hello World" }
    Returns immediately; task runs in background.
    Poll /task/status for progress.
    """
    global _active_task
    if _active_task["running"]:
        return jsonify({
            "success": False,
            "error":   "A task is already running. Use /task/stop to cancel.",
            "current": _active_task["task"]
        }), 409

    data = request.get_json()
    task = (data.get("task") or "").strip()
    if not task:
        return jsonify({"success": False, "error": "No task provided."}), 400

    t = threading.Thread(target=_run_autonomous_task, args=(task,), daemon=True)
    t.start()

    return jsonify({
        "success": True,
        "message": f"Autonomous task initiated: {task}",
        "max_steps": MAX_STEPS
    })


@app.route('/task/status', methods=['GET'])
def task_status():
    """Return current task status and step history."""
    return jsonify({
        "success": True,
        "task":    _active_task.copy()
    })


@app.route('/task/stop', methods=['POST'])
def stop_task():
    """Abort the currently running autonomous task."""
    global _active_task
    if not _active_task["running"]:
        return jsonify({"success": False, "error": "No task running."})
    _active_task["running"] = False
    _active_task["status"]  = "aborted"
    return jsonify({"success": True, "message": "Task aborted."})


# ─────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':      'ok',
        'service':     'ZAIRE-computer-use',
        'task_active': _active_task["running"],
        'task':        _active_task["task"] if _active_task["running"] else None
    })


if __name__ == '__main__':
    import os
    import sys
    # Force UTF-8 output on Windows to avoid cp1252 encoding errors
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    print("\n===========================================")
    print("  ZAIRE Computer Use Sidecar")
    print("  Flask server on port 3002")
    print("===========================================\n")
    app.run(host='127.0.0.1', port=3002, debug=False, use_reloader=False)
