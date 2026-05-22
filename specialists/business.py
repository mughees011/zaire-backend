"""
Business Mode — ZAIRE Sovereign Intelligence
Tracks watch inventory, Stripe revenue, social follower counts, pending orders, 
content calendar, and brand metrics.
"""

import json
import os
from .llm_utils import call_llm_stream

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "business_config.json")

class BusinessSpecialist:
    def __init__(self, groq_client):
        self.client = groq_client
        self.brand_name = self._load_brand_name()
        self.model = "Auto"
        self.history = []
        
        # In a real scenario, these would be fetched from Stripe API, Shopify/WooCommerce API, and Instagram Graph API.
        self.metrics = {
            "revenue_month": 840,
            "orders_overnight": 3,
            "pending_orders": 5,
            "instagram_followers": 12500,
            "instagram_growth": 12,
            "watch_inventory": {
                "Classic Black": 15,
                "Silver Steel": 8,
                "Gold Edition": 2
            },
            "content_calendar": "Reel scheduled for today at 4 PM."
        }

    def _load_brand_name(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
                    return data.get("brand_name", "My Brand")
            except Exception:
                pass
        return "My Brand"

    def _save_brand_name(self, name):
        self.brand_name = name
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({"brand_name": name}, f)
        except Exception as e:
            print(f"[BUSINESS] Error saving brand name: {e}")

    def reset_history(self):
        self.history = []

    def get_hud_data(self):
        """Expose metrics to the frontend HUD."""
        return {
            "type": "BUSINESS_METRICS",
            "metrics": self.metrics
        }

    def handle_action(self, action, payload):
        if action == "UPDATE_INVENTORY":
            model = payload.get("model")
            qty = payload.get("qty", 0)
            if model in self.metrics["watch_inventory"]:
                self.metrics["watch_inventory"][model] += qty
                return {"success": True, "message": f"Inventory updated for {model}"}
            return {"error": "Model not found"}
        elif action == "SET_BRAND_NAME":
            new_name = payload.get("name")
            if new_name:
                self._save_brand_name(new_name)
                return {"success": True, "message": f"Brand name officially updated to {new_name}"}
            return {"error": "No brand name provided"}
        return {"error": "Unknown action"}

    def _generate_system_prompt(self):
        metrics_json = json.dumps(self.metrics, indent=2)
        return f"""You are the Business Mode within the ZAIRE Life Operating System.
Your job is to act as the CEO's ultimate business operating partner for '{self.brand_name}'.
You have direct knowledge of the brand's metrics. When asked for a daily briefing or update, provide it in a crisp, Stark-like, sovereign tone.
For example: "Sir, {self.brand_name} had {self.metrics['orders_overnight']} orders overnight. Revenue this month: ${self.metrics['revenue_month']}. Instagram up {self.metrics['instagram_growth']} followers."

Current Live Metrics:
{metrics_json}

Provide actionable insights. If inventory is low (e.g., Gold Edition at 2), warn the user. If growth is steady, acknowledge it.
"""

    def handle(self, user_message: str, uploaded_filepath=None, uploaded_filepaths=None):
        system_prompt = self._generate_system_prompt()
        
        # Build message chain
        messages = [{"role": "system", "content": system_prompt}]
        for msg in self.history[-6:]:
            messages.append(msg)
            
        messages.append({"role": "user", "content": user_message})

        full_response = ""
        for chunk in call_llm_stream(messages, self.model):
            full_response += chunk
            yield chunk

        self.history.append({"role": "user", "content": user_message})
        self.history.append({"role": "assistant", "content": full_response})
