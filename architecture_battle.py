# '''Architecture Battle Mode – side‑by‑side comparison of two AI/ML architectures.
#
# Endpoints:
#   GET  /battle/list                 -> list all supported architectures
#   POST /battle/compare               -> {"arch1": "Transformer", "arch2": "RNN"}
#                                           returns a detailed comparison JSON.
#
# The data is stored in a static dictionary for now but can be extended to a JSON file.
# The service also publishes a 'battle_compare' event via the shared EventBus so the UI HUD can animate a split‑screen.
#
# Runs on localhost:3076.
# '''

import uuid, time, threading, json, os
from pathlib import Path
from typing import Dict, Any, List

from flask import Flask, request, jsonify
from flask_cors import CORS

# Optional EventBus – UI can subscribe to progress events
try:
    from backend.event_bus import EventBus
    _bus = EventBus.get_instance()
except Exception:
    _bus = None

app = Flask(__name__)
CORS(app)

# ----------------------------------------------------------------------
# Static architecture data – can be moved to a JSON file later
# ----------------------------------------------------------------------
_ARCH_DATA: Dict[str, Dict[str, Any]] = {
    "Transformer": {
        "type": "Neural Network",
        "year": 2017,
        "inventor": "Vaswani et al.",
        "speed": "Medium (depends on implementation)",
        "memory": "High (attention matrix O(n^2))",
        "parallelization": "Excellent – full sequence processed at once",
        "use_cases": ["NLP", "Vision", "Multimodal"],
        "real_world_applications": ["ChatGPT", "BERT", "Stable Diffusion"]
    },
    "RNN": {
        "type": "Recurrent Neural Network",
        "year": 1990,
        "inventor": "Hopfield, Elman",
        "speed": "Slow (sequential time‑step processing)",
        "memory": "Low‑Medium (hidden state only)",
        "parallelization": "Poor – time‑step dependency",
        "use_cases": ["Speech", "Time‑Series", "Seq2Seq"],
        "real_world_applications": ["Early language models", "Music generation"]
    },
    "CNN": {
        "type": "Convolutional Neural Network",
        "year": 1998,
        "inventor": "LeCun et al.",
        "speed": "Fast (GPU‑friendly convolutions)",
        "memory": "Medium",
        "parallelization": "Good – layer‑wise parallelism",
        "use_cases": ["Image Classification", "Object Detection", "Video"],
        "real_world_applications": ["ResNet", "YOLO", "VGG"]
    },
    "GNN": {
        "type": "Graph Neural Network",
        "year": 2005,
        "inventor": "Scarselli et al.",
        "speed": "Variable (depends on graphs)",
        "memory": "Variable",
        "parallelization": "Limited – message passing steps",
        "use_cases": ["Social Networks", "Molecular Property Prediction"],
        "real_world_applications": ["AlphaFold (protein graphs)", "Recommendation systems"]
    }
}

# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------
def _list_architectures() -> List[str]:
    return sorted(_ARCH_DATA.keys())

def _compare(arch1: str, arch2: str) -> Dict[str, Any]:
    a1 = _ARCH_DATA.get(arch1)
    a2 = _ARCH_DATA.get(arch2)
    if not a1 or not a2:
        raise ValueError("One or both architectures not recognized")
    # Build side‑by‑side dict preserving the same keys
    comparison = {
        "arch1": {"name": arch1, **a1},
        "arch2": {"name": arch2, **a2},
        "differences": {
            "speed": {arch1: a1["speed"], arch2: a2["speed"]},
            "memory": {arch1: a1["memory"], arch2: a2["memory"]},
            "parallelization": {arch1: a1["parallelization"], arch2: a2["parallelization"]},
            "year": {arch1: a1["year"], arch2: a2["year"]},
            "inventor": {arch1: a1["inventor"], arch2: a2["inventor"]},
        }
    }
    return comparison

# ----------------------------------------------------------------------
# API routes
# ----------------------------------------------------------------------
@app.get("/battle/list")
def api_list():
    return jsonify({"success": True, "architectures": _list_architectures()})

@app.post("/battle/compare")
def api_compare():
    payload = request.get_json() or {}
    arch1 = payload.get("arch1")
    arch2 = payload.get("arch2")
    if not arch1 or not arch2:
        return jsonify({"success": False, "error": "Both arch1 and arch2 are required"}), 400
    try:
        result = _compare(arch1, arch2)
        # Fire EventBus update for UI (optional)
        if _bus:
            import asyncio
            async def _pub():
                await _bus.publish("battle_compare", {"arch1": arch1, "arch2": arch2})
            asyncio.run(_pub())
        return jsonify({"success": True, "comparison": result})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": f"internal error: {e}"}), 500

# ----------------------------------------------------------------------
if __name__ == "__main__":
    print("[BATTLE] Architecture Battle Mode service listening on 3076")
    app.run(host="127.0.0.1", port=3076, debug=False, use_reloader=False, threaded=True)
