"""
run_trader.py - Standalone bootstrap for the ZAIRE Trader Daemon.
Spawned by index.js as: python run_trader.py
"""
import sys
import os

# Force unbuffered output so heartbeats appear immediately in Node pipe
os.environ.setdefault("PYTHONUNBUFFERED", "1")
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Put the backend root on sys.path so `specialists` is a findable package
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure specialists is treated as a package (create __init__ if missing)
specialists_init = os.path.join(backend_dir, "specialists", "__init__.py")
if not os.path.exists(specialists_init):
    open(specialists_init, "w").close()

from groq import Groq
from specialists.trader import TraderSpecialist

if __name__ == "__main__":
    print("[TRADER] Starting standalone daemon mode (via run_trader.py)...", flush=True)
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    trader = TraderSpecialist(groq_client)
    trader._apex_daemon_loop()
