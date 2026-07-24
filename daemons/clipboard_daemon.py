"""
ZAIRE Clipboard Intelligence Daemon — Tier 2 Brain Upgrade (#6)
Flask sidecar on port 3007.

Watches the clipboard every second. When you copy:
  - Code     → ZAIRE explains/debugs it automatically
  - URL      → ZAIRE fetches title + summary
  - Math     → ZAIRE solves it
  - Plain text → ZAIRE offers to translate, summarize, or act on it

Install: pip install pyperclip flask flask-cors requests
"""

import os
import sys
import re
import time
import json
import threading
import hashlib
import requests as req_lib
from specialists.llm_utils import call_llm_sync

try:
    import pyperclip
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError as e:
    print(f"[CLIPBOARD] Missing: {e}")
    print("Run: pip install pyperclip flask flask-cors requests")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Config ──────────────────────────────────────────────────────────────────
MIN_TEXT_LEN    = 20                            # ignore tiny copies (< 20 chars)
POLL_INTERVAL   = 1.0                           # seconds between clipboard checks
ZAIRE_BACKEND_URL = "http://127.0.0.1:3001"       # Node.js backend for push events

# ─── State ───────────────────────────────────────────────────────────────────
last_hash:    str  = ""
watch_active: bool = False
watch_thread        = None
last_analysis: dict = {}

# ─── Content Classifiers ─────────────────────────────────────────────────────

CODE_PATTERNS = [
    r'\bdef\s+\w+\s*\(',        # Python function
    r'\bfunction\s+\w+\s*\(',   # JS function
    r'\bclass\s+\w+[\s:{]',     # class definition
    r'import\s+\w+',            # import statement
    r'#include\s*<',            # C/C++
    r'\bconst\s+\w+\s*=',       # JS const
    r'\bint\s+\w+\s*\(',        # C-style function
    r'^\s*(if|for|while|switch)\s*\(', # control flow
    r':\s*$',                   # Python block ending
    r'\{\s*\n',                 # block opening brace
    r'console\.log\(',          # JS debug
    r'print\s*\(',              # Python print
    r'SELECT\s+.*\s+FROM',      # SQL
    r'<\w+[\s>]',               # HTML tag
]

URL_PATTERN = re.compile(r'^https?://\S+$', re.IGNORECASE)

MATH_PATTERNS = [
    r'[\d\s\+\-\*\/\^\(\)=]+\s*=',   # equation
    r'\d+\s*[\+\-\*\/]\s*\d+',        # arithmetic
    r'∫|∑|√|π|∞|≤|≥|≠',              # math symbols
    r'\b(solve|integrate|differentiate|limit)\b',
]


def _classify(text: str) -> str:
    """Classify clipboard content type."""
    stripped = text.strip()

    # URL check
    if URL_PATTERN.match(stripped):
        return "url"

    # Address check
    if re.search(r'\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Lane|Way)', stripped):
        return "address"

    # Price check
    if re.search(r'(\$|Rs|£|€)\s*\d+(\.\d{2})?', stripped):
        return "price"

    # Code check
    lines = stripped.split('\n')
    code_signals = sum(
        1 for line in lines
        for pat in CODE_PATTERNS
        if re.search(pat, line, re.MULTILINE)
    )
    if code_signals >= 2 or (code_signals >= 1 and len(lines) > 3):
        return "code"

    # Math check
    math_signals = sum(1 for pat in MATH_PATTERNS if re.search(pat, stripped))
    if math_signals >= 1 and len(stripped) < 200:
        return "math"

    return "text"


# ─── Analysis ───────────────────────────────────────────────────────────

def _ai_call(prompt: str) -> str:
    """Call the active AI Vault providers via shared multi-provider lane routing."""
    try:
        content = call_llm_sync(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=400
        )
        if not content:
            return "No active LLM provider configured in AI Vault."
        return content
    except Exception as e:
        return f"Analysis error: {e}"


def _analyze_code(code: str) -> dict:
    prompt = f"""You are ZAIRE, a senior engineer AI.
The user just copied this code:

```
{code[:3000]}
```

In 2-4 sentences:
1. What does it do?
2. Any bugs or improvements you notice?

Be direct and address the user as 'sir'."""
    return {
        "type": "code",
        "analysis": _ai_call(prompt),
        "preview": code[:100].replace('\n', ' ')
    }


def _analyze_url(url: str) -> dict:
    # Try to fetch page title
    title = url
    try:
        r = req_lib.get(url, timeout=4, headers={"User-Agent": "Mozilla/5.0"})
        match = re.search(r'<title[^>]*>(.*?)</title>', r.text, re.IGNORECASE | re.DOTALL)
        if match:
            title = match.group(1).strip()[:120]
    except Exception:
        pass

    prompt = f"""The user copied this URL: {url}
Page title: {title}

In 2 sentences: what is this page likely about, and is it relevant to studying or work?
Address the user as 'sir'."""
    return {
        "type": "url",
        "url": url,
        "title": title,
        "analysis": _ai_call(prompt)
    }


def _analyze_math(expr: str) -> dict:
    prompt = f"""Solve this math expression or equation and show steps:

{expr[:500]}

Be concise and clear. Address the user as 'sir'."""
    return {
        "type": "math",
        "expression": expr[:100],
        "analysis": _ai_call(prompt)
    }


def _analyze_text(text: str, content_type: str = "text") -> dict:
    if content_type == "address":
        prompt = f"The user copied an address: '{text}'. Suggest opening it in Google Maps and briefly mention if it's near their usual route."
    elif content_type == "price":
        prompt = f"The user copied a price: '{text}'. Briefly tell them if this seems high or low for the current market and offer to find a comparison."
    else:
        prompt = f"""The user copied this text:

"{text[:1500]}"

In 2-3 sentences: summarize what this is and what it's about.
Then end with ONE useful action they could take (translate, study, email, etc.).
Address the user as 'sir'."""

    return {
        "type": content_type,
        "preview": text[:80].replace('\n', ' '),
        "analysis": _ai_call(prompt)
    }


def _push_to_zaire(result: dict):
    """Push clipboard analysis to Node.js backend."""
    try:
        req_lib.post(
            f"{ZAIRE_BACKEND_URL}/clipboard/event",
            json=result,
            timeout=2
        )
    except Exception:
        pass


# ─── Clipboard Watcher Thread ─────────────────────────────────────────────────

def _watch_loop():
    global last_hash, watch_active, last_analysis

    print("[CLIPBOARD] Watcher started.")
    while watch_active:
        try:
            text = pyperclip.paste()

            if not text or len(text.strip()) < MIN_TEXT_LEN:
                time.sleep(POLL_INTERVAL)
                continue

            current_hash = hashlib.md5(text.encode()).hexdigest()
            if current_hash == last_hash:
                time.sleep(POLL_INTERVAL)
                continue

            last_hash = current_hash
            content_type = _classify(text.strip())

            print(f"[CLIPBOARD] New {content_type} detected ({len(text)} chars)")

            result = {}
            if content_type == "code":
                result = _analyze_code(text.strip())
            elif content_type == "url":
                result = _analyze_url(text.strip())
            elif content_type == "math":
                result = _analyze_math(text.strip())
            else:
                result = _analyze_text(text.strip(), content_type)

            result["timestamp"] = time.time()
            result["length"]    = len(text)
            last_analysis = result

            # Push to ZAIRE frontend
            _push_to_zaire(result)

        except Exception as e:
            print(f"[CLIPBOARD] Watch error: {e}")

        time.sleep(POLL_INTERVAL)

    print("[CLIPBOARD] Watcher stopped.")


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/clipboard/start", methods=["POST"])
def start_watch():
    global watch_active, watch_thread
    if watch_active:
        return jsonify({"success": True, "message": "Clipboard watcher already active."})
    watch_active = True
    watch_thread = threading.Thread(target=_watch_loop, daemon=True)
    watch_thread.start()
    return jsonify({"success": True, "message": "Clipboard intelligence engaged, sir."})


@app.route("/clipboard/stop", methods=["POST"])
def stop_watch():
    global watch_active
    watch_active = False
    return jsonify({"success": True, "message": "Clipboard watcher disengaged."})


@app.route("/clipboard/status", methods=["GET"])
def status():
    return jsonify({
        "active":        watch_active,
        "last_analysis": last_analysis
    })


@app.route("/clipboard/analyze", methods=["POST"])
def analyze_manual():
    """
    Manually analyze text (no watcher needed).
    Body: { "text": "..." }
    """
    data = request.get_json()
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"success": False, "error": "No text provided."}), 400

    content_type = _classify(text)
    if content_type == "code":
        result = _analyze_code(text)
    elif content_type == "url":
        result = _analyze_url(text)
    elif content_type == "math":
        result = _analyze_math(text)
    else:
        result = _analyze_text(text)

    result["timestamp"] = time.time()
    return jsonify({"success": True, **result})


@app.route("/clipboard/last", methods=["GET"])
def last():
    """Return the last analyzed clipboard event."""
    return jsonify({"success": True, "analysis": last_analysis})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "zaire-clipboard-intelligence"})


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE Clipboard Intelligence Daemon")
    print("  Flask server on port 3007")
    print("==============================================\n")

    # Auto-start watcher
    watch_active = True
    watch_thread = threading.Thread(target=_watch_loop, daemon=True)
    watch_thread.start()

    app.run(host="127.0.0.1", port=3007, debug=False, use_reloader=False)
