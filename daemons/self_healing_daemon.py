import time, os, requests, datetime, subprocess

LOG_FILE = os.path.join(os.getcwd(), "zaire_runtime.log")
BACKEND_URL = "http://127.0.0.1:3001/engineer/heal"
GUARDIAN_LOG = os.path.join(os.getcwd(), "memory", "guardian.log")

def log_event(message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}\n"
    # Safe print for Windows consoles
    try:
        print(entry.strip())
    except UnicodeEncodeError:
        print(entry.encode('ascii', 'ignore').decode('ascii').strip())

    try:
        os.makedirs(os.path.dirname(GUARDIAN_LOG), exist_ok=True)
        with open(GUARDIAN_LOG, "a", encoding="utf-8") as f:
            f.write(entry)
    except: pass

def monitor():
    log_event("🛡️ Sentinel active. Watching for architectural fractures...")
    
    # Ensure log file exists
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w") as f:
            f.write(f"# ZAIRE Runtime Log Initialized at {datetime.datetime.now()}\n")

    with open(LOG_FILE, "r") as f:
        # Move to end of file
        f.seek(0, 2)
        while True:
            line = f.readline()
            if not line:
                time.sleep(1)
                continue
            
            # Detect errors, crashes, and critical warnings
            if any(trigger in line for trigger in ["ERROR", "Traceback", "Exception", "CRITICAL", "Fracture"]):
                log_event(f"⚠️ Structural fracture detected: {line.strip()[:100]}...")
                
                # Attempt autonomous report to Engineer Specialist
                try:
                    res = requests.post(BACKEND_URL, json={
                        "error": line.strip(),
                        "timestamp": datetime.datetime.now().isoformat(),
                        "context": "gladiator-guardian-v2"
                    }, timeout=10)
                    if res.json().get('success'):
                        log_event("✅ Repair sequence successfully handed over to Engineer Specialist.")
                    else:
                        log_event("⚠️ Engineer Specialist reported a busy buffer. Retrying in 5s.")
                except Exception as e:
                    log_event(f"❌ Failed to reach command core: {e}")

if __name__ == "__main__":
    monitor()
