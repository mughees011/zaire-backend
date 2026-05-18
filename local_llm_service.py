"""
ZAIRE Local LLM Fallback Service — Tier 1 Brain Upgrade
Flask server on port 3005.

Wraps Ollama (local LLaMA 3 / Mistral) with a streaming endpoint
that matches the Groq API contract used by the rest of ZAIRE.

When Groq is down / slow, Node.js falls back here automatically.

Install:
    1. Download Ollama from https://ollama.com
    2. Run: ollama pull llama3          (7B model, ~4GB)
           OR
           ollama pull llama3:8b-instruct-q4_KM  (smaller/faster)
    3. pip install flask flask-cors requests
"""

import os
import sys
import json
import time
import requests
from specialists.llm_utils import call_llm_sync

try:
    from flask import Flask, request, jsonify, Response, stream_with_context
    from flask_cors import CORS
except ImportError as e:
    print(f"[LOCAL_LLM] Missing: {e}")
    print("Run: pip install flask flask-cors requests")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Ollama Config ───────────────────────────────────────────────────────────

OLLAMA_BASE    = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL  = os.getenv("OLLAMA_MODEL", "llama3")          # primary
FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "mistral") # if llama3 unavailable

# ─── Helpers ─────────────────────────────────────────────────────────────────

def ollama_available() -> bool:
    """Check if Ollama daemon is running."""
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def get_available_model() -> str | None:
    """Return the first available model from our priority list."""
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
        if r.status_code != 200:
            return None
        models = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        for candidate in [DEFAULT_MODEL, FALLBACK_MODEL]:
            if any(candidate in m for m in models):
                return candidate
        # Return whatever is available
        return models[0] if models else None
    except Exception:
        return None


def _stream_ollama(messages: list, model: str, temperature: float, max_tokens: int):
    """Generator: stream tokens from Ollama's /api/chat endpoint."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        }
    }

    with requests.post(
        f"{OLLAMA_BASE}/api/chat",
        json=payload,
        stream=True,
        timeout=120
    ) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                chunk = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break
            except json.JSONDecodeError:
                continue


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/llm/health", methods=["GET"])
def health():
    """Returns Ollama status + available models."""
    available = ollama_available()
    model     = get_available_model() if available else None
    return jsonify({
        "status":    "ok" if available else "offline",
        "service":   "zaire-local-llm",
        "ollama":    available,
        "model":     model,
        "base":      OLLAMA_BASE
    })


@app.route("/llm/chat", methods=["POST"])
def chat():
    """
    Groq-compatible chat endpoint (non-streaming).
    Body: {
        "messages": [...],
        "model": "llama3",       // optional override
        "temperature": 0.7,
        "max_tokens": 1024
    }
    """
    data        = request.get_json()
    messages    = data.get("messages", [])
    temperature = float(data.get("temperature", 0.7))
    max_tokens  = int(data.get("max_tokens", 1024))
    model       = data.get("model") or get_available_model() or DEFAULT_MODEL

    if not messages:
        return jsonify({"success": False, "error": "No messages provided."}), 400

    if not ollama_available():
        return jsonify({
            "success": False,
            "error": "Ollama is not running. Please start it with: ollama serve"
        }), 503

    print(f"[LOCAL_LLM] Chat request → model={model}, msgs={len(messages)}")

    full_response = ""
    try:
        for token in _stream_ollama(messages, model, temperature, max_tokens):
            full_response += token
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({
        "success": True,
        "content": full_response,
        "model":   model,
        "source":  "local_ollama"
    })


@app.route("/llm/stream", methods=["POST"])
def chat_stream():
    """
    Streaming chat endpoint — returns server-sent tokens.
    Body: same as /llm/chat
    Uses text/event-stream so Node.js can pipe it just like a Groq stream.
    """
    data        = request.get_json()
    messages    = data.get("messages", [])
    temperature = float(data.get("temperature", 0.7))
    max_tokens  = int(data.get("max_tokens", 1024))
    model       = data.get("model") or get_available_model() or DEFAULT_MODEL

    if not messages:
        return jsonify({"success": False, "error": "No messages provided."}), 400

    if not ollama_available():
        # Return a graceful error as a stream so Node.js doesn't crash
        def error_stream():
            yield "Sir, the local neural core is offline. Starting Groq fallback."
        return Response(stream_with_context(error_stream()), mimetype="text/plain")

    print(f"[LOCAL_LLM] Stream request → model={model}, msgs={len(messages)}")

    def generate():
        try:
            for token in _stream_ollama(messages, model, temperature, max_tokens):
                yield token
        except Exception as e:
            yield f"\n[LOCAL_LLM ERROR] {e}"

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route("/llm/models", methods=["GET"])
def list_models():
    """Lists all models available in the local Ollama instance."""
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
        if r.status_code != 200:
            return jsonify({"success": False, "models": []})
        models = [m["name"] for m in r.json().get("models", [])]
        return jsonify({"success": True, "models": models})
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "models": []})


@app.route("/llm/pull", methods=["POST"])
def pull_model():
    """
    Download a model from Ollama registry.
    Body: { "model": "llama3" }
    Streams download progress back.
    """
    data  = request.get_json()
    model = data.get("model", DEFAULT_MODEL)

    def pull_stream():
        try:
            with requests.post(
                f"{OLLAMA_BASE}/api/pull",
                json={"name": model},
                stream=True,
                timeout=600
            ) as resp:
                for line in resp.iter_lines():
                    if line:
                        try:
                            info = json.loads(line)
                            status = info.get("status", "")
                            yield f"[PULL] {model}: {status}\n"
                        except:
                            pass
            yield f"[PULL] {model}: Complete.\n"
        except Exception as e:
            yield f"[PULL ERROR] {e}\n"

    return Response(stream_with_context(pull_stream()), mimetype="text/plain")


# ─── A simple proxy: if Node.js calls this, it routes to Groq first, ─────────
# then falls back to local if Groq fails. Useful for the agent_daemon. ───────

@app.route("/llm/smart_chat", methods=["POST"])
def smart_chat():
    """
    Smart routing: tries Groq first, falls back to local Ollama.
    Body: { "messages": [...], "groq_api_key": "...", "model": "llama-3.3-70b-versatile" }
    """
    data        = request.get_json()
    messages    = data.get("messages", [])
    groq_key    = data.get("groq_api_key") or os.getenv("GROQ_API_KEY")
    groq_model  = data.get("model", "llama-3.3-70b-versatile")
    temperature = float(data.get("temperature", 0.7))
    max_tokens  = int(data.get("max_tokens", 1024))

    # Try Groq first
    if groq_key:
        try:
            print(f"[LOCAL_LLM] SmartChat → Attempting Groq ({groq_model})...")
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": groq_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
                timeout=15
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                print(f"[LOCAL_LLM] SmartChat → Groq OK.")
                return jsonify({
                    "success": True,
                    "content": content,
                    "source": "groq"
                })
            else:
                print(f"[LOCAL_LLM] Groq returned {resp.status_code} — falling back to Ollama.")
        except Exception as e:
            print(f"[LOCAL_LLM] Groq failed ({e}) — falling back to Ollama.")

    # Fallback to Ollama
    if not ollama_available():
        return jsonify({
            "success": False,
            "error": "Both Groq and Ollama are unavailable.",
            "source": "none"
        }), 503

    model = get_available_model() or DEFAULT_MODEL
    print(f"[LOCAL_LLM] SmartChat → Using local Ollama ({model}).")

    full_response = ""
    try:
        for token in _stream_ollama(messages, model, temperature, max_tokens):
            full_response += token
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({
        "success": True,
        "content": full_response,
        "model": model,
        "source": "local_ollama"
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE Local LLM Fallback (Ollama Bridge)")
    print("  Flask server on port 3005")
    print("==============================================\n")

    # Announce Ollama status on startup
    if ollama_available():
        model = get_available_model()
        print(f"[LOCAL_LLM] Ollama is ONLINE. Active model: {model or 'none — run: ollama pull llama3'}")
    else:
        print("[LOCAL_LLM] WARNING: Ollama is not running. Start it with: ollama serve")
        print("[LOCAL_LLM] Download: https://ollama.com — then: ollama pull llama3")

    app.run(host="127.0.0.1", port=3005, debug=False, use_reloader=False)
