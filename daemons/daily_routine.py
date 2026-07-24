import threading
import time
from datetime import datetime, timedelta
import pytz

# Optional import of EventBus for publishing events to UI/HUD
try:
    from backend.event_bus import EventBus
    _bus = EventBus.get_instance()
except Exception:
    _bus = None

# Configuration: Define daily schedule (24‑hour clock, local timezone)
# Each entry: (hour, minute, event_name, optional payload)
DAILY_SCHEDULE = [
    (8, 0, "morning_briefing", {}),
    (9, 0, "study_session_reminder", {}),
    (12, 0, "meal_check", {}),
    (14, 0, "market_alert", {}),
    (18, 0, "gym_reminder", {}),
    (22, 0, "night_summary", {}),
]

# Keep track of which events have been fired today to avoid repeats
_fired_today = set()

def _reset_fired():
    global _fired_today
    _fired_today = set()

def _publish(event_name: str, payload: dict):
    if _bus:
        import asyncio
        async def _pub():
            await _bus.publish(event_name, payload)
        asyncio.run(_pub())
    else:
        print(f"[DAILY] Event '{event_name}' triggered (no EventBus). Payload: {payload}")

def _scheduler_loop(timezone_str: str = "Asia/Kolkata"):
    tz = pytz.timezone(timezone_str)
    print(f"[DAILY] Scheduler started with timezone {timezone_str}")
    while True:
        now = datetime.now(tz)
        # Reset once per day at midnight
        if now.hour == 0 and now.minute == 0:
            _reset_fired()
        for hour, minute, name, payload in DAILY_SCHEDULE:
            if (now.hour, now.minute) == (hour, minute) and (hour, minute, name) not in _fired_today:
                _publish(name, payload)
                _fired_today.add((hour, minute, name))
        # Sleep a short interval to keep CPU low (check every 30 seconds)
        time.sleep(30)

# Start the scheduler in a background daemon thread
scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True, name="DailyScheduler")
scheduler_thread.start()

# If this file is executed directly, keep the main thread alive
if __name__ == "__main__":
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("[DAILY] Scheduler stopped by user")
