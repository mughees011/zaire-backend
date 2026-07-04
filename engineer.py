import sys
import json
import os
import requests
import traceback

try:
    from design_intelligence import (
        WEBSITE_PROFILES, 
        DNA_PROFILES, 
        COMPONENT_PATTERNS, 
        FILE_TEMPLATES, 
        PERFORMANCE_STANDARDS, 
        ANTI_PATTERNS, 
        ENGINEER_SYSTEM_PROTOCOL
    )
except ImportError:
    print(json.dumps({"error": "design_intelligence.py not found"}))
    sys.exit(1)

def call_llm(system_prompt, user_prompt):
    # Fetch API Key from environment or .env file (handled by Node calling this)
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise Exception("GROQ_API_KEY missing in environment variables.")
    
    headers = {
        "Authorization": f"Bearer {groq_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.4,
        "max_tokens": 6000
    }
    
    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=90)
    if not res.ok:
        raise Exception(f"LLM API Error: {res.text}")
    
    return res.json()["choices"][0]["message"]["content"]

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing payload arguments."}))
        sys.exit(1)
        
    try:
        # Load the payload string passed from Node.js
        payload = json.loads(sys.argv[1])
        plan = payload.get("plan", {})
        intake = payload.get("intake", {})
        
        system_prompt = f"""{ENGINEER_SYSTEM_PROTOCOL}
        
--- DESIGN INTELLIGENCE CORE v4.0 ---
WEBSITE PROFILES: {json.dumps(WEBSITE_PROFILES)}
DNA PROFILES: {json.dumps(DNA_PROFILES)}
ANTI_PATTERNS: {json.dumps(ANTI_PATTERNS)}
PERFORMANCE: {json.dumps(PERFORMANCE_STANDARDS)}
FILE_TEMPLATES (USE THESE AS STARTING POINTS): {json.dumps(FILE_TEMPLATES)}

You are generating a full project scaffold based on the user's plan.
You MUST output a valid JSON object matching exactly this schema:
{{
  "files": {{
    "app/layout.tsx": {{"content": "..."}},
    "app/page.tsx": {{"content": "..."}},
    "app/globals.css": {{"content": "..."}},
    "tailwind.config.ts": {{"content": "..."}}
  }}
}}

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. NO markdown formatting blocks (do not wrap in ```json).
3. NO conversational text before or after the JSON.
4. Fully implement the files using the DNA Profiles and Anti-Patterns.
"""
        
        user_prompt = f"Scaffold the following website:\n\nPLAN:\n{json.dumps(plan, indent=2)}\n\nINTAKE:\n{json.dumps(intake, indent=2)}"
        
        result_text = call_llm(system_prompt, user_prompt)
        
        # Fallback strip in case LLM disobeys and wraps in markdown
        if result_text.startswith("```json"):
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif result_text.startswith("```"):
            result_text = result_text.split("```")[1].split("```")[0].strip()
            
        # Parse and dump to stdout for Node to read
        result_json = json.loads(result_text)
        print(json.dumps(result_json))
        
    except Exception as e:
        # Print error in JSON format so Node can parse the failure gracefully
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
