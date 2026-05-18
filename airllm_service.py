"""
ZAIRE AirLLM Deep Intelligence Service — Tier 2 Brain Upgrade
Flask server on port 3012.

Enables inference of massive 70B+ models on consumer hardware by using layer-wise offloading.
Specifically designed for 'Deep Thinking' tasks where speed is less important than raw intelligence.
"""

import os
import sys
import json
import time
import threading
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

try:
    from airllm import AutoModel
    import torch
except ImportError as e:
    print(f"[AIRLLM] Missing: {e}")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Global State ───────────────────────────────────────────────────────────

model_instance = None
current_model_id = None
inference_lock = threading.Lock()

# ─── Configurations ─────────────────────────────────────────────────────────

MODEL_MAP = {
    "deep-think-70b": "garage-bAInd/Platypus2-70B-instruct",
    "llama3-70b": "meta-llama/Meta-Llama-3-70B-Instruct",
}

DEFAULT_MODEL = "deep-think-70b"

# ─── Helpers ────────────────────────────────────────────────────────────────

def get_model(model_id):
    global model_instance, current_model_id
    
    repo_id = MODEL_MAP.get(model_id, MODEL_MAP[DEFAULT_MODEL])
    
    if model_instance is None or current_model_id != model_id:
        print(f"[AIRLLM] Loading {repo_id} via AirLLM (this may take a few minutes)...")
        # Initialize AirLLM model with 4-bit compression for speed/memory
        model_instance = AutoModel.from_pretrained(
            repo_id,
            compression='4bit',
            profiling_mode=False
        )
        current_model_id = model_id
        print(f"[AIRLLM] Model {model_id} loaded successfully.")
        
    return model_instance

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/deep/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "zaire-airllm-deep-intel",
        "model_loaded": current_model_id,
        "supported_models": list(MODEL_MAP.keys())
    })

@app.route("/deep/think", methods=["POST"])
def think():
    """
    Deep Thinking endpoint (non-streaming for now, as AirLLM layer offloading 
    makes streaming tokens difficult to synchronize with real-time UI).
    """
    if not inference_lock.acquire(blocking=False):
        return jsonify({"success": False, "error": "System is already deep thinking. Please wait."}), 429

    try:
        data = request.get_json()
        prompt = data.get("prompt", "")
        model_id = data.get("model", DEFAULT_MODEL)
        max_new_tokens = int(data.get("max_tokens", 256))

        if not prompt:
            return jsonify({"success": False, "error": "No prompt provided."}), 400

        print(f"[AIRLLM] Deep Think Request: {prompt[:50]}...")
        
        model = get_model(model_id)
        
        input_tokens = model.tokenizer(
            [prompt], 
            return_tensors="pt", 
            return_attention_mask=False, 
            truncation=True, 
            max_length=1024, 
            padding=False
        )

        start_time = time.time()
        generation_output = model.generate(
            input_tokens['input_ids'].cuda() if torch.cuda.is_available() else input_tokens['input_ids'],
            max_new_tokens=max_new_tokens,
            use_cache=True,
            return_dict_in_generate=True
        )
        end_time = time.time()

        output_text = model.tokenizer.decode(generation_output.sequences[0], skip_special_tokens=True)
        
        print(f"[AIRLLM] Reasoning complete in {end_time - start_time:.2f}s")

        return jsonify({
            "success": True,
            "content": output_text,
            "model": model_id,
            "duration": end_time - start_time,
            "source": "airllm_local"
        })

    except Exception as e:
        print(f"[AIRLLM ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        inference_lock.release()

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE AirLLM Deep Intelligence Service")
    print("  Flask server on port 3012")
    print("==============================================\n")
    
    app.run(host="127.0.0.1", port=3012, debug=False, use_reloader=False)
