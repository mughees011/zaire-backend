import os
import glob
import time
from typing import List, Dict
from .llm_utils import call_llm_sync, call_llm_stream

VISION_MODEL = os.getenv(
    "ZAIRE_VISION_MODEL",
    os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
)

class ZaireVision:
    """
    ZaireVision: The "Stark" eye for complex artifacts.
    Handles images, videos, documents, and entire project structures.
    Uses Groq's LLaVA for images and text analysis.
    """
    def __init__(self):
        self.history = []
        
        self.system_prompt = (
            "You are ZAIRE, a highly sophisticated AI assistant. "
            "You have been provided with 'Artifacts' (files, folders, media). "
            "Analyze them with tactical precision. Explain complex code, "
            "describe visual scenes, and summarize documents with Stark-like wit. "
            "Address the user as 'sir'. Keep responses concise and informative."
        )

    def call_groq(self, model: str, messages: list):
        """Make an LLM call with shared failover utility."""
        return call_llm_sync(messages, model)

    def handle(self, user_message: str, manifest: List[Dict] = None, uploaded_filepath: str = None, uploaded_filepaths: list = None, **kwargs):
        """
        Processes a prompt relative to uploaded artifacts.
        manifest: List of objects with {path, name, mimetype} from the Node.js uplink.
        """
        try:
            analysis_parts = []
            has_images = False
            
            if manifest:
                for item in manifest:
                    file_path = item.get('path')
                    mimetype = item.get('mimetype', '')
                    file_name = item.get('name', 'unknown')
                    
                    if not os.path.exists(file_path):
                        analysis_parts.append(f"[File not found: {file_name}]")
                        continue
                    
                    # Handle Images
                    if "image" in mimetype:
                        has_images = True
                        try:
                            import base64
                            with open(file_path, 'rb') as f:
                                img_data = base64.b64encode(f.read()).decode('utf-8')
                            
                            # Use LLaVA for image analysis
                            messages = [
                                {
                                    "role": "user",
                                    "content": [
                                        {"type": "text", "text": f"Analyze this image and help answer: {user_message}"},
                                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_data}"}}
                                    ]
                                }
                            ]
                            vision_result = self.call_groq(VISION_MODEL, messages)
                            analysis_parts.append(f"[IMAGE: {file_name}]\n{vision_result}")
                        except Exception as e:
                            analysis_parts.append(f"[IMAGE ERROR: {file_name}] {str(e)}")
                    
                    # Handle Text/Code files
                    elif any(kw in mimetype for kw in ["text", "javascript", "python", "json", "typescript", "html", "css", "markdown", "application"]):
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # Truncate very long files
                                if len(content) > 8000:
                                    content = content[:8000] + "\n... [truncated]"
                                analysis_parts.append(f"[FILE: {file_name}]\n```\n{content}\n```")
                        except Exception as e:
                            analysis_parts.append(f"[ERROR reading {file_name}]: {str(e)}")
                    
                    # Handle other files
                    else:
                        file_size = os.path.getsize(file_path)
                        analysis_parts.append(f"[FILE: {file_name}] Type: {mimetype}, Size: {file_size} bytes")

            # Build final prompt
            artifacts_context = "\n\n".join(analysis_parts) if analysis_parts else "No artifacts provided."
            
            if not self.history:
                full_prompt = f"{self.system_prompt}\n\nARTIFACTS:\n{artifacts_context}\n\nUSER COMMAND: {user_message}"
            else:
                full_prompt = f"Previous context: {' '.join([h.get('content', '') for h in self.history[-2:]])}\n\nUser: {user_message}"

            # Use Groq for text processing (using a fast model for analysis)
            if has_images:
                model = VISION_MODEL
            else:
                model = "Auto"
            
            messages = [{"role": "user", "content": full_prompt}]
            response = self.call_groq(model, messages)
            
            # Yield response in chunks for streaming
            for i in range(0, len(response), 50):
                yield response[i:i+50]
                time.sleep(0.02)
            
            # Update history
            self.history.append({"role": "user", "content": user_message})
            self.history.append({"role": "assistant", "content": response})
            
            # Keep history manageable
            if len(self.history) > 10:
                self.history = self.history[-10:]

        except Exception as e:
            print(f"[ZAIRE_VISION] CRITICAL ERROR: {str(e)}")
            yield f"[SERVICE_ERROR] ZAIRE vision digestion failed: {str(e)}"

    def get_hud_data(self):
        """Returns data for the Stark HUD."""
        return {
            "status": "Ready",
            "files_processed": len(self.history) // 2,
            "vision_active": True,
            "engine": "Groq LLaVA + LLaMA"
        }

    def reset_history(self):
        self.history = []
