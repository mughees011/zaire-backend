import psutil
import os
import signal

for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cmdline = proc.info['cmdline']
        if cmdline and 'agent_daemon.py' in ' '.join(cmdline):
            print(f"Killing Agent Daemon (PID: {proc.info['pid']})")
            os.kill(proc.info['pid'], signal.SIGTERM)
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass
