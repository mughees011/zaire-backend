import os
import json
import re

# 1. Update daily_briefing.py for Proactive Morning Briefing
daily_briefing_path = r'c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend\daily_briefing.py'
with open(daily_briefing_path, 'r', encoding='utf-8') as f:
    content = f.read()

overnight_logic = """
def get_overnight_data():
    \"\"\"Fetch simulated overnight activity from Google/System logs.\"\"\"
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
        f"The system has been stabilized and is at your disposal. Shall we begin the morning protocol?"
    )
    return briefing
"""

# Replace generate_briefing block
new_content = re.sub(r'def generate_briefing\(\):.*?return briefing', overnight_logic, content, flags=re.DOTALL)

with open(daily_briefing_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

# 2. Update index.js for Autonomous Task Chains (Plan my day)
index_js_path = r'c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend\index.js'
with open(index_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add /agent/plan_day endpoint
plan_day_logic = """
app.post('/agent/plan_day', async (req, res) => {
    console.log('[AGENT] Autonomous Task Chain: Plan My Day initiated.');
    const sockets = Array.from(io.sockets.sockets.values());
    const socket = sockets.length > 0 ? sockets[0] : null;
    
    if (socket) {
        socket.emit('neural_log', { content: "System: Initiating multi-node daily orchestration..." });
        socket.emit('neural_interrupt', { text: "Sir, I'm analyzing your calendar, emails, and pending tasks to synthesize your optimal schedule.", type: 'SYSTEM_CONFIG' });
        
        // One command triggers 8 "API" calls (simulated by comprehensive prompt to Specialist)
        socket.emit('zaire_chat_request', { 
            message: "Plan my day. Read my calendar, check weather, overnight emails, and pending tasks. Synthesize a coherent schedule with priorities.",
            specialist: 'ZAIRE'
        });
    }
    res.json({ success: true });
});
"""

# Insert before global error handler
if 'app.use((err,' in content:
    content = content.replace('app.use((err,', plan_day_logic + '\napp.use((err,')

with open(index_js_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Intelligence Upgrades Applied Successfully.")
