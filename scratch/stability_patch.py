import os
import re

# 1. Update App.js (Frontend Code Streaming Robustness)
app_js_path = r'c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\frontend-temp\src\App.js'
with open(app_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Refine the code extraction logic to be more robust
old_delta_logic = """
        if (next.includes('```')) {
           const codeParts = next.split('```');
           if (codeParts.length >= 2) {
              setLiveCodeStream(codeParts[1]);
           }
        }
"""
new_delta_logic = """
        if (next.includes('```')) {
           const codeBlocks = next.match(/```[\\s\\S]*?```/g);
           if (codeBlocks && codeBlocks.length > 0) {
              const lastBlock = codeBlocks[codeBlocks.length - 1];
              const cleaned = lastBlock.replace(/```[a-zA-Z]*\\n?/, '').replace(/```$/, '');
              setLiveCodeStream(cleaned);
           } else if (next.includes('```')) {
              // Handle partial block (starting with ``` but not ending)
              const partial = next.split('```').pop().replace(/^[a-zA-Z]*\\n?/, '');
              setLiveCodeStream(partial);
           }
        }
"""
content = content.replace(old_delta_logic, new_delta_logic)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Update face_security.py (Redundant Notification Suppression)
face_sec_path = r'c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend\face_security.py'
with open(face_sec_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add a state flag to prevent spamming 'detected' event
if 'state = {' in content:
    content = content.replace('state = {', 'state = {\n    "last_notified_presence": "none",')

# Update the presence notification logic
old_notify = """
                        # Notify ZAIRE frontend
                        try:
                            import requests
                            requests.post(
                                f"{BACKEND_URL}/presence",
                                json={"status": "detected", "user": "Master"},
                                timeout=2
                            )
                        except Exception:
                            pass
"""
new_notify = """
                        # Notify ZAIRE frontend (Once per state change)
                        if state.get("last_notified_presence") != "detected":
                            try:
                                import requests
                                requests.post(
                                    f"{BACKEND_URL}/presence",
                                    json={"status": "detected", "user": "Master"},
                                    timeout=2
                                )
                                state["last_notified_presence"] = "detected"
                            except Exception:
                                pass
"""
content = content.replace(old_notify, new_notify)

# Also update absence notification
old_absent = """
                if absent_secs > 5:
                    state["master_present"]       = False
                    state["master_confirm_count"] = 0
                    _log(f"👤 Master absent (gone {absent_secs:.0f}s)")
"""
new_absent = """
                if absent_secs > 5:
                    state["master_present"]       = False
                    state["master_confirm_count"] = 0
                    if state.get("last_notified_presence") != "absent":
                        _log(f"👤 Master absent (gone {absent_secs:.0f}s)")
                        state["last_notified_presence"] = "absent"
"""
content = content.replace(old_absent, new_absent)

with open(face_sec_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Stability Patches Applied Successfully.")
