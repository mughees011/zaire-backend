import os
import time
import json
import requests
import threading
from groq import Groq

# ── CONFIGURATION ─────────────────────────────────────────────────────────────

# Lane 1: Primary (Groq)
GROQ_DEFAULT_MODEL = os.getenv("GROQ_MODEL", "").strip()

# Lane 2: Secondary (SiliconFlow)
FALLBACK_MODELS = [
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-V2.5",
    "Qwen/Qwen2.5-72B-Instruct",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct"
]

SF_URLS = [
    "https://api.siliconflow.cn/v1/chat/completions",
    "https://api.siliconflow.com/v1/chat/completions"
]

# Memory Service for Semantic Cache & Local Fallback
VECTOR_MEMORY_URL = "http://127.0.0.1:3004"
LOCAL_LLM_URL     = "http://127.0.0.1:3005"
BACKEND_URL       = "http://127.0.0.1:3001"

# Lane 3: Tertiary (OpenAI or Final SiliconFlow Shield)
TERTIARY_MODEL = os.getenv("OPENAI_MODEL", "").strip()
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "memory", "system_config.json")


def _load_runtime_slots():
    """Load up to 3 provider slots from persisted ZAIRE settings."""
    try:
        if not os.path.exists(CONFIG_PATH):
            return []
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        slots = cfg.get("aiVault", {}).get("slots", [])
        if not isinstance(slots, list):
            return []
        return slots[:3]
    except Exception:
        return []


def _provider_keys_pool(provider_name: str) -> list:
    target = (provider_name or "").strip().lower()
    keys = []
    
    # 1. Load keys from persisted ZAIRE settings (Slots)
    for s in _load_runtime_slots():
        if not s.get("enabled", True):
            continue
        if str(s.get("provider", "")).strip().lower() != target:
            continue
        key = str(s.get("apiKey", "")).strip()
        if key and key not in keys:
            keys.append(key)
            
    return keys


def _provider_key(provider_name: str) -> str:
    pool = _provider_keys_pool(provider_name)
    return pool[0] if pool else ""


def _normalize_model(provider_name: str, configured_model: str, fallback: str = "") -> str:
    target = (provider_name or "").strip().lower()
    model = (configured_model or "").strip()
    fb = (fallback or "").strip()
    
    generic_labels = {"", "auto", "fast", "primary", "coding", "fallback", "deep reasoning", "code specialist"}
    resolved_fallback = "" if fb.lower() in generic_labels else fb

    if model.lower() not in generic_labels:
        return model
            
    if target == "groq":
        return os.getenv("GROQ_MODEL", "").strip() or resolved_fallback or "llama-3.3-70b-versatile"
    if target == "siliconflow":
        return resolved_fallback or "deepseek-ai/DeepSeek-V3"
    if target == "google gemini":
        return resolved_fallback or "gemini-1.5-flash"
    if target == "openai":
        return resolved_fallback or "gpt-4o-mini"
    if target == "openrouter":
        return resolved_fallback or "openrouter/auto"
    if target == "deepseek":
        return resolved_fallback or "deepseek-chat"
    if target == "mistral":
        return resolved_fallback or "mistral-small-latest"
    if target == "anthropic":
        return os.getenv("ANTHROPIC_MODEL", "").strip() or resolved_fallback or "claude-3-5-sonnet-20241022"
    if target == "cohere":
        return os.getenv("COHERE_MODEL", "").strip() or resolved_fallback or "command-r-plus"

    return resolved_fallback or model or "gpt-4o-mini"

def _provider_model(provider_name: str, fallback: str = "") -> str:
    target = (provider_name or "").strip().lower()
    for s in _load_runtime_slots():
        if not s.get("enabled", True):
            continue
        if str(s.get("provider", "")).strip().lower() != target:
            continue
        return _normalize_model(target, str(s.get("model", "")).strip(), fallback)
    return _normalize_model(target, "", fallback)

_RUNTIME_PROVIDER_CACHE = {"ts": 0.0, "slots": []}


def _runtime_slots() -> list:
    now = time.time()
    if now - _RUNTIME_PROVIDER_CACHE["ts"] < 10 and _RUNTIME_PROVIDER_CACHE["slots"]:
        return _RUNTIME_PROVIDER_CACHE["slots"]
    try:
        r = requests.get(f"{BACKEND_URL}/llm/runtime-providers", timeout=2)
        if r.status_code == 200 and r.json().get("success"):
            slots = r.json().get("slots", [])[:3]
            _RUNTIME_PROVIDER_CACHE["slots"] = slots
            _RUNTIME_PROVIDER_CACHE["ts"] = now
            return slots
    except Exception:
        pass
    return _RUNTIME_PROVIDER_CACHE["slots"]


def _detect_mode(messages: list) -> str:
    text = " ".join([str(m.get("content", "")) for m in (messages or [])[:3]]).lower()
    if "professor" in text or "study" in text or "academic" in text:
        return "PROFESSOR"
    if "trader" in text or "market" in text or "halal" in text:
        return "TRADER"
    if "engineer" in text or "code" in text or "build" in text:
        return "ENGINEER"
    return "ZAIRE"


def _ordered_slots_for_mode(messages: list) -> list:
    slots = [s for s in _runtime_slots() if s.get("enabled", True) and s.get("provider") != "Empty" and s.get("apiKey")]
    mode = _detect_mode(messages)
    preferred = {
        "ENGINEER": ["Coding", "Primary", "Fallback"],
        "PROFESSOR": ["Research", "Primary", "Fallback"],
        "TRADER": ["Primary", "Research", "Fallback"],
        "ZAIRE": ["Primary", "Research", "Coding", "Fallback"]
    }.get(mode, ["Primary", "Fallback"])
    ranked = []
    for p in preferred:
        ranked.extend([s for s in slots if str(s.get("purpose", "")).lower() == p.lower()])
    for s in slots:
        if s not in ranked:
            ranked.append(s)
    return ranked[:3]


def _parse_openai_stream(resp):
    for line in resp.iter_lines():
        if not line:
            continue
        line_str = line.decode("utf-8")
        if not line_str.startswith("data: "):
            continue
        data_str = line_str[6:]
        if data_str == "[DONE]":
            break
        try:
            data = json.loads(data_str)
            content = data.get("choices", [{}])[0].get("delta", {}).get("content")
            if content:
                yield content
        except Exception:
            continue


def _call_provider_sync(slot: dict, messages, temperature, max_tokens):
    provider = str(slot.get("provider", "")).strip().lower()
    keys_pool = _provider_keys_pool(provider)
    if not keys_pool and slot.get("apiKey"):
        keys_pool = [slot.get("apiKey")]
        
    if not keys_pool:
        return None

    model = str(slot.get("model", "")).strip()

    for idx, key in enumerate(keys_pool):
        try:
            if provider == "groq":
                client = Groq(api_key=key)
                use_model = _normalize_model("groq", model)
                r = client.chat.completions.create(model=use_model, messages=messages, temperature=temperature, max_tokens=max_tokens)
                return r.choices[0].message.content

            if provider in {"openai", "deepseek", "mistral", "azure openai"}:
                base_url = slot.get("baseUrl", "").strip()
                headers = {"Content-Type": "application/json"}
                use_model = _normalize_model(provider, model)
                if provider == "openai":
                    use_model = _normalize_model("openai", model, os.getenv("OPENAI_MODEL", ""))
                payload = {"model": use_model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
                if provider == "deepseek" and not base_url:
                    base_url = "https://api.deepseek.com/v1/chat/completions"
                if provider == "mistral" and not base_url:
                    base_url = "https://api.mistral.ai/v1/chat/completions"
                if provider == "openai" and not base_url:
                    base_url = "https://api.openai.com/v1/chat/completions"
                if provider == "azure openai":
                    if not base_url:
                        continue
                    headers["api-key"] = key
                else:
                    headers["Authorization"] = f"Bearer {key}"
                r = requests.post(base_url, headers=headers, json=payload, timeout=45)
                if r.status_code != 200:
                    continue
                return r.json().get("choices", [{}])[0].get("message", {}).get("content")

            if provider == "anthropic":
                url = slot.get("baseUrl", "").strip() or "https://api.anthropic.com/v1/messages"
                use_model = _normalize_model("anthropic", model)
                payload = {"model": use_model, "max_tokens": max_tokens, "messages": [m for m in messages if m.get("role") in {"user", "assistant"}]}
                r = requests.post(url, headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, json=payload, timeout=45)
                if r.status_code != 200:
                    continue
                parts = r.json().get("content", [])
                texts = [p.get("text", "") for p in parts if p.get("type") == "text"]
                return "".join(texts).strip()

            if provider == "google gemini":
                use_model = _normalize_model("google gemini", model)
                base = slot.get("baseUrl", "").strip() or f"https://generativelanguage.googleapis.com/v1beta/models/{use_model}:generateContent"
                payload = {"contents": [{"parts": [{"text": "\n".join([str(m.get("content", "")) for m in messages])}]}]}
                r = requests.post(f"{base}?key={key}", headers={"content-type": "application/json"}, json=payload, timeout=45)
                if r.status_code != 200:
                    continue
                cands = r.json().get("candidates", [])
                if not cands:
                    continue
                parts = cands[0].get("content", {}).get("parts", [])
                return "".join([p.get("text", "") for p in parts]).strip()

            if provider == "cohere":
                url = slot.get("baseUrl", "").strip() or "https://api.cohere.com/v2/chat"
                use_model = _normalize_model("cohere", model)
                payload = {"model": use_model, "messages": messages, "temperature": temperature}
                r = requests.post(url, headers={"Authorization": f"Bearer {key}", "content-type": "application/json"}, json=payload, timeout=45)
                if r.status_code != 200:
                    continue
                return (
                    r.json().get("message", {}).get("content", [{}])[0].get("text")
                    or r.json().get("text")
                    or ""
                )

            if provider == "siliconflow":
                use_model = _normalize_model("siliconflow", model)
                r = _call_siliconflow(messages, use_model, temperature, max_tokens, stream=False, api_key=key)
                if not r or r == "RATE_LIMIT":
                    continue
                return r.json().get("choices", [{}])[0].get("message", {}).get("content")

        except Exception as e:
            import sys; print(f"[FAILOVER] Key failure for provider {provider} (index {idx+1}): {e}", file=sys.stderr)
            continue

    return None

# ── NEURAL LANE MANAGER ───────────────────────────────────────────────────────

class NeuralLaneManager:
    """Manages 3 prioritized lanes of intelligence with autonomous shifting."""
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.lane_status = {1: "HEALTHY", 2: "HEALTHY", 3: "HEALTHY"}
        self.lane_failures = {1: 0, 2: 0, 3: 0}
        self.lane_last_check = {1: 0, 2: 0, 3: 0}
        self.max_failures = 3
        self.cooldown_period = 60 # 1 minute

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def report_failure(self, lane):
        self.lane_failures[lane] += 1
        if self.lane_failures[lane] >= self.max_failures:
            self.lane_status[lane] = "SATURATED"
            self.lane_last_check[lane] = time.time()
            import sys; print(f"[NEURAL_LINK] 🚨 Lane {lane} saturated. Shifting operational focus.", file=sys.stderr)

    def report_success(self, lane):
        self.lane_failures[lane] = 0
        self.lane_status[lane] = "HEALTHY"

    def get_optimal_lane(self):
        now = time.time()
        for lane in [1, 2, 3]:
            # Check if lane is in cooldown
            if self.lane_status[lane] == "SATURATED":
                if now - self.lane_last_check[lane] > self.cooldown_period:
                    self.lane_status[lane] = "HEALTHY"
                    self.lane_failures[lane] = 0
                    return lane
                continue
            return lane
        return 1 # Fallback to 1 if all are "saturated" (force retry)

lane_manager = NeuralLaneManager.get_instance()

# ── CORE UTILITIES ────────────────────────────────────────────────────────────

def _is_rate_limit(error_msg: str) -> bool:
    """Detect rate limit or saturation errors."""
    err = str(error_msg).lower()
    return any(x in err for x in ["429", "rate_limit", "limit_reached", "saturated", "tpd", "rpd", "quota"])

def _call_siliconflow(messages, model, temperature, max_tokens, stream=False, api_key=None):
    """Internal helper to call SiliconFlow API."""
    if not api_key:
        api_key = _provider_key("SiliconFlow")
    if not api_key:
        return None
    
    for url in SF_URLS:
        try:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream
            }
            resp = requests.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=30,
                stream=stream
            )
            
            if resp.status_code == 200:
                return resp
            elif resp.status_code == 429:
                return "RATE_LIMIT"
            else:
                continue
        except Exception:
            continue
    return None

def _call_openai(messages, model, temperature, max_tokens, stream=False):
    """Internal helper to call OpenAI API as Lane 3."""
    api_key = _provider_key("OpenAI")
    if not api_key or "your_key_here" in api_key:
        return None
        
    try:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }
        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
            stream=stream
        )
        if resp.status_code == 200:
            return resp
        elif resp.status_code == 429:
            return "RATE_LIMIT"
    except Exception:
        pass
    return None

def _call_local_llm(messages, model, temperature, max_tokens, stream=False):
    """Internal helper to call Local Ollama Bridge as a final shadow lane."""
    try:
        url = f"{LOCAL_LLM_URL}/llm/stream" if stream else f"{LOCAL_LLM_URL}/llm/chat"
        resp = requests.post(
            url,
            json={"messages": messages, "temperature": temperature, "max_tokens": max_tokens},
            timeout=30,
            stream=stream
        )
        if resp.status_code == 200:
            return resp
    except Exception:
        pass
    return None

def _check_cache(query: str) -> str | None:
    """Check if we have a highly similar response in the semantic cache."""
    try:
        r = requests.post(f"{VECTOR_MEMORY_URL}/memory/cache/recall", json={"query": query}, timeout=2)
        if r.status_code == 200:
            data = r.json()
            if data.get("hit"):
                return data.get("response")
    except Exception:
        pass
    return None

def _store_cache(query: str, response: str):
    """Store a response in the semantic cache."""
    try:
        requests.post(f"{VECTOR_MEMORY_URL}/memory/cache/store", json={"query": query, "response": response}, timeout=1)
    except Exception:
        pass

def _optimize_prompt(messages: list, level: str = "TURBO") -> list:
    """Inject quota-saving instructions into the system prompt."""
    if not messages: return messages
    
    # Locate system prompt or create one
    sys_idx = -1
    for i, m in enumerate(messages):
        if m.get("role") == "system":
            sys_idx = i
            break
            
    instruction = "\n[QUOTA_SAVER: Be extremely concise. Avoid filler. Provide the best possible answer in minimum tokens.]"
    if level == "TURBO":
        if sys_idx >= 0:
            messages[sys_idx]["content"] += instruction
        else:
            messages.insert(0, {"role": "system", "content": f"You are ZAIRE.{instruction}"})
            
    return messages

# ── PUBLIC API ───────────────────────────────────────────────────────────────

def call_llm_sync(messages, model=None, temperature=0.3, max_tokens=3000):
    """Non-streaming LLM call with semantic cache and slot-based provider routing."""
    user_query = messages[-1].get("content", "") if messages else ""
    if len(user_query) > 10:
        cached = _check_cache(user_query)
        if cached:
            import sys; print("[NEURAL_LINK] Semantic Cache HIT.", file=sys.stderr)
            return cached

    messages = _optimize_prompt(messages)

    if len(user_query) < 20 and len(user_query.split()) < 4:
        resp = _call_local_llm(messages, None, temperature, max_tokens, stream=False)
        if resp:
            return resp.json().get("content", "Sir.")

    slots = _ordered_slots_for_mode(messages)
    for idx, slot in enumerate(slots, start=1):
        lane = min(idx, 3)
        try:
            import sys; print(f"[NEURAL_LINK] Lane {lane}: provider={slot.get('provider')} purpose={slot.get('purpose')}", file=sys.stderr)
            content = _call_provider_sync(slot, messages, temperature, max_tokens)
            if content:
                lane_manager.report_success(lane)
                if len(user_query) > 10:
                    _store_cache(user_query, content)
                return content
            lane_manager.report_failure(lane)
        except Exception as e:
            if _is_rate_limit(str(e)):
                lane_manager.report_failure(lane)
            import sys; print(f"[NEURAL_LINK] Provider error ({slot.get('provider')}): {e}", file=sys.stderr)

    return "[SYSTEM ERROR] No configured provider returned a response. Please update AI Vault keys."
def call_llm_stream(messages, model=None, temperature=0.3, max_tokens=3000):
    """Streaming LLM call with semantic cache and slot-based provider routing."""
    user_query = messages[-1].get("content", "") if messages else ""
    if len(user_query) > 10:
        cached = _check_cache(user_query)
        if cached:
            import sys; print("[NEURAL_LINK] Semantic Cache HIT (stream).", file=sys.stderr)
            yield cached
            return

    messages = _optimize_prompt(messages)

    if len(user_query) < 20 and len(user_query.split()) < 4:
        resp = _call_local_llm(messages, None, temperature, max_tokens, stream=True)
        if resp:
            for line in resp.iter_lines():
                if line:
                    yield line.decode('utf-8')
            return

    slots = _ordered_slots_for_mode(messages)
    for idx, slot in enumerate(slots, start=1):
        lane = min(idx, 3)
        provider = str(slot.get("provider", "")).strip().lower()
        keys_pool = _provider_keys_pool(provider)
        if not keys_pool and slot.get("apiKey"):
            keys_pool = [slot.get("apiKey")]
            
        for key_idx, key in enumerate(keys_pool):
            try:
                if provider == 'groq':
                    client = Groq(api_key=key)
                    use_model = _normalize_model("groq", str(slot.get('model', '')).strip())
                    stream = client.chat.completions.create(
                        model=use_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        stream=True
                    )
                    for chunk in stream:
                        content = chunk.choices[0].delta.content
                        if content:
                            lane_manager.report_success(lane)
                            yield content
                    return

                if provider in {'openai', 'deepseek', 'mistral', 'azure openai'}:
                    base_url = str(slot.get('baseUrl', '')).strip()
                    headers = {"Content-Type": "application/json"}
                    use_model = _normalize_model(provider, str(slot.get('model', '')).strip())
                    if provider == "openai":
                        use_model = _normalize_model("openai", str(slot.get('model', '')).strip(), os.getenv("OPENAI_MODEL", ""))
                    if provider == 'deepseek' and not base_url:
                        base_url = 'https://api.deepseek.com/v1/chat/completions'
                    if provider == 'mistral' and not base_url:
                        base_url = 'https://api.mistral.ai/v1/chat/completions'
                    if provider == 'openai' and not base_url:
                        base_url = 'https://api.openai.com/v1/chat/completions'
                    if provider == 'azure openai':
                        if not base_url:
                            raise Exception('Azure OpenAI requires baseUrl')
                        headers['api-key'] = key
                    else:
                        headers['Authorization'] = f"Bearer {key}"
                    resp = requests.post(base_url, headers=headers, json={"model": use_model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": True}, timeout=45, stream=True)
                    if resp.status_code == 200:
                        for tok in _parse_openai_stream(resp):
                            lane_manager.report_success(lane)
                            yield tok
                        return
                    else:
                        raise Exception(f"HTTP {resp.status_code}")

                if provider == 'siliconflow':
                    use_model = _normalize_model("siliconflow", str(slot.get('model', '')).strip())
                    resp = _call_siliconflow(messages, use_model, temperature, max_tokens, stream=True, api_key=key)
                    if resp and resp != 'RATE_LIMIT' and resp.status_code == 200:
                        for tok in _parse_openai_stream(resp):
                            lane_manager.report_success(lane)
                            yield tok
                        return
                    else:
                        raise Exception("SiliconFlow request failed")

            except Exception as e:
                import sys; print(f"[FAILOVER] Stream key fail for {provider} (index {key_idx + 1}): {e}", file=sys.stderr)
                if _is_rate_limit(str(e)):
                    lane_manager.report_failure(lane)
                continue
                
        # If all keys for this slot failed, report failure on the lane
        lane_manager.report_failure(lane)

    yield "[SYSTEM ERROR] No configured provider returned a response."

# ── GLOBAL FAILOVER WRAPPER (API QUOTA SAVER) ────────────────────────────────

class MockDelta:
    def __init__(self, content): self.content = content

class MockStreamChoice:
    def __init__(self, content): self.delta = MockDelta(content)

class MockStreamChunk:
    def __init__(self, content): self.choices = [MockStreamChoice(content)]

class MockMessage:
    def __init__(self, content): self.content = content

class MockSyncChoice:
    def __init__(self, content): self.message = MockMessage(content)

class MockSyncResponse:
    def __init__(self, content): self.choices = [MockSyncChoice(content)]

class SafeCompletions:
    def create(self, model, messages, temperature=0.3, max_tokens=3000, stream=False, **kwargs):
        prompt_length = sum(len(str(m.get('content', ''))) for m in messages)
        optimized_model = model
        
        if stream:
            def _mock_stream():
                for text in call_llm_stream(messages, optimized_model, temperature, max_tokens):
                    yield MockStreamChunk(text)
            return _mock_stream()
        else:
            content = call_llm_sync(messages, optimized_model, temperature, max_tokens)
            return MockSyncResponse(content)

class SafeChat:
    def __init__(self): self.completions = SafeCompletions()

class SafeGroqClient:
    """A drop-in replacement for Groq() that enforces 3-lane failover and token saving."""
    def __init__(self, api_key=None): self.chat = SafeChat()

