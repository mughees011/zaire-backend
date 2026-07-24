import json
import os
import requests
import datetime
import random

# --- Configuration ---
WEATHER_URL = "https://wttr.in/Karachi?format=j1"
QUOTE_URL   = "https://zenquotes.io/api/random"
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_FILE  = os.path.join(BACKEND_DIR, "memory", "tasks.json")
LOG_FILE    = os.path.join(BACKEND_DIR, "memory", "neural_log.txt")

def get_weather():
    try:
        response = requests.get(WEATHER_URL, timeout=5)
        if response.status_code == 200:
            data = response.json()
            current = data['current_condition'][0]
            temp = current['temp_C']
            desc = current['weatherDesc'][0]['value']
            return f"{temp}°C, {desc}"
    except Exception:
        return "currently unavailable"
    return "unknown"

def get_quote():
    """Fetch a random inspirational quote."""
    try:
        r = requests.get(QUOTE_URL, timeout=3)
        if r.status_code == 200:
            data = r.json()[0]
            return f'"{data["q"]}" — {data["a"]}'
    except Exception:
        pass
    quotes = [
        "Intelligence is the ability to adapt to change.",
        "The best way to predict the future is to create it.",
        "Precision is the difference between a tool and a toy."
    ]
    return random.choice(quotes)

def get_news():
    """Fetch top headlines (Mocking with search-style headlines for now)."""
    try:
        # In a real scenario, we'd use a News API or the web_search tool.
        # Since this script runs standalone, we'll suggest a web search to the LLM
        # OR we can scrape a simple news site here.
        return "Global markets are showing stability; AI advancements continue to dominate tech headlines; Local infrastructure projects are ahead of schedule."
    except Exception:
        return "No major headlines to report, sir."

def get_upcoming_tasks():
    try:
        if os.path.exists(TASKS_FILE):
            with open(TASKS_FILE, 'r') as f:
                data = json.load(f)
                tasks = data.get('tasks', [])
                if tasks:
                    subset = tasks[:3]
                    formatted = [f"{t['title']} at {t['time']}" for t in subset]
                    return ", ".join(formatted)
    except Exception:
        pass
    return "Your schedule is currently clear"

def get_recent_activity():
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r') as f:
                lines = f.readlines()
                recent = [l.strip().split('] ', 1)[-1] for l in lines[-10:] if ']' in l]
                if recent:
                    unique = list(dict.fromkeys(recent))
                    return "; ".join(unique[-3:])
    except Exception:
        pass
    return "System logs are clean"

def get_overnight_data():
    """Fetch simulated overnight activity from Google/System logs."""
    return {
        "emails": "3 unread messages from Engineering Team; 1 newsletter from MarketWatch.",
        "calendar": "Neural Architectures study at 11:00 AM; Trader Strategy review at 3:00 PM."
    }


def get_overnight_data():
    """Fetch simulated overnight activity from Google/System logs."""
    return {
        "emails": "3 unread messages from Engineering Team; 1 newsletter from MarketWatch.",
        "calendar": "Neural Architectures study at 11:00 AM; Trader Strategy review at 3:00 PM."
    }

def generate_briefing():
    # Pakistan Standard Time (UTC+5)
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=5)
    date_str = now.strftime("%A, %B %d")
    hour = now.hour
    
    greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 18 else "Good evening")
    
    weather  = get_weather()
    tasks    = get_upcoming_tasks()
    activity = get_recent_activity()
    news     = get_news()
    overnight = get_overnight_data()
    
    briefing = (
        f"{greeting}, sir. It is {date_str}. "
        f"The current conditions in Karachi are {weather}. "
        f"Overnight, you received: {overnight['emails']}. "
        f"Today's primary objectives from your calendar: {overnight['calendar']}. "
        f"Market update: {news}. "
        f"ZAIRE is fully synchronized and at your disposal. Shall we begin the morning protocol?"
    )
    return briefing


if __name__ == "__main__":
    print(generate_briefing())
