import os
import sys
import importlib.util

backend_dir = r"c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend"
sys.path.append(backend_dir)

daemons = [
    "agent_daemon.py",
    "alarm_scheduler.py",
    "clipboard_daemon.py",
    "face_security.py",
    "file_watcher.py",
    "local_llm_service.py",
    "observer_daemon.py",
    "process_monitor.py",
    "self_healing_daemon.py",
    "system_health.py",
    "vector_memory.py"
]

print(f"Checking {len(daemons)} daemons...")

for f in daemons:
    name = f[:-3]
    path = os.path.join(backend_dir, f)
    print(f"Testing {name}...", end=" ")
    try:
        # Mocking some things that might prevent execution
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        # We don't want to actually RUN them (start servers), just check syntax/imports
        # However, some might run code on import.
        # Let's try to just compile them first.
        with open(path, "r", encoding="utf-8") as file:
            compile(file.read(), path, 'exec')
        print("OK (Compiled)")
    except Exception as e:
        print(f"FAILED: {e}")
