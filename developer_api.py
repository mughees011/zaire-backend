"""
ZAIRE Developer API (v1)
A REST API that allows 3rd-party developers to build and register custom modes,
integrations, and plugins for ZAIRE. Transforms ZAIRE from a tool into a Platform.
"""

import os
import uuid
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

from specialists.router import SpecialistRouter
from specialists.llm_utils import call_llm_stream

app = Flask(__name__)
CORS(app)

# In-memory registry of 3rd party plugins
# In production, this would be a database (PostgreSQL/MongoDB) with authentication & monetization checks.
PLUGIN_REGISTRY = {}

# A generic specialist class that adapts to a developer's plugin configuration
class DynamicPluginSpecialist:
    def __init__(self, plugin_config):
        self.config = plugin_config
        self.model = plugin_config.get("model", "llama-3.3-70b-versatile")
        self.history = []
        self.system_prompt = plugin_config.get("system_prompt", "You are a custom ZAIRE plugin.")

    def reset_history(self):
        self.history = []

    def handle(self, user_message: str, uploaded_filepath=None, uploaded_filepaths=None):
        messages = [{"role": "system", "content": self.system_prompt}]
        for msg in self.history[-6:]:
            messages.append(msg)
            
        messages.append({"role": "user", "content": user_message})

        full_response = ""
        for chunk in call_llm_stream(messages, self.model):
            full_response += chunk
            yield chunk

        self.history.append({"role": "user", "content": user_message})
        self.history.append({"role": "assistant", "content": full_response})


# ─── Endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/v1/plugins/register")
def register_plugin():
    """
    Allows a developer to register a new mode/plugin.
    Payload:
      - name (str): Display name of the mode.
      - developer_id (str): Developer's unique ID.
      - system_prompt (str): The core personality/instructions for the mode.
      - price (float): The price of the plugin (for the App Store model).
    """
    data = request.json
    if not data or 'name' not in data or 'system_prompt' not in data:
        return jsonify({"success": False, "error": "Missing required fields: name, system_prompt"}), 400

    plugin_id = f"plugin_{uuid.uuid4().hex[:8]}"
    
    PLUGIN_REGISTRY[plugin_id] = {
        "id": plugin_id,
        "name": data["name"].upper(),
        "developer_id": data.get("developer_id", "anonymous"),
        "system_prompt": data["system_prompt"],
        "price": data.get("price", 0.0),
        "status": "approved", # In reality, would require marketplace review
        "created_at": time.time()
    }
    
    return jsonify({
        "success": True, 
        "plugin_id": plugin_id,
        "message": "Plugin registered successfully. Available for use."
    })


@app.get("/api/v1/plugins/list")
def list_plugins():
    """Returns the marketplace list of available plugins."""
    plugins = [
        {"id": k, "name": v["name"], "price": v["price"], "developer": v["developer_id"]} 
        for k, v in PLUGIN_REGISTRY.items()
    ]
    return jsonify({"success": True, "plugins": plugins})


@app.post("/api/v1/plugins/chat")
def chat_with_plugin():
    """
    Interact with a registered plugin.
    Payload:
      - plugin_id (str)
      - message (str)
    """
    data = request.json
    plugin_id = data.get("plugin_id")
    message = data.get("message")
    
    if not plugin_id or plugin_id not in PLUGIN_REGISTRY:
        return jsonify({"success": False, "error": "Invalid or unknown plugin_id"}), 404
        
    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty"}), 400

    plugin_config = PLUGIN_REGISTRY[plugin_id]
    
    # Instantiate the dynamic specialist
    specialist = DynamicPluginSpecialist(plugin_config)
    
    # Stream the response back (here we collect it for the REST response, 
    # but a WebSocket would be used for live streaming)
    response_text = ""
    for chunk in specialist.handle(message):
        if isinstance(chunk, str):
            response_text += chunk
            
    # Platform Cut Simulation
    revenue = plugin_config["price"]
    zaire_cut = revenue * 0.30
    dev_cut = revenue * 0.70

    return jsonify({
        "success": True,
        "response": response_text,
        "monetization": {
            "total_revenue": revenue,
            "zaire_platform_fee": zaire_cut,
            "developer_earnings": dev_cut
        }
    })

if __name__ == "__main__":
    print("[DEVELOPER API] ZAIRE Marketplace listening on port 3090")
    app.run(host="127.0.0.1", port=3090, debug=False, use_reloader=False, threaded=True)
