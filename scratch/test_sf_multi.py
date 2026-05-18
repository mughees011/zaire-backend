import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# NEW KEY FROM .ENV
api_key = os.getenv("SILICONFLOW_API_KEY", "sk-sajhmchbldwigajvoscmshlmhgmmcersiearotsjzjselbub")
models = ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-V2.5", "deepseek-ai/DeepSeek-R1"]

for domain in ["cn", "com"]:
    url = f"https://api.siliconflow.{domain}/v1/chat/completions"
    print(f"--- Testing {domain.upper()} ---")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-ai/DeepSeek-V3",
        "messages": [{"role": "user", "content": "hi"}],
        "temperature": 0.7
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        output_text = response.text[:200]
        try:
            print(f"Response: {output_text}")
        except UnicodeEncodeError:
            print(f"Response: {output_text.encode('ascii', 'replace').decode('ascii')}")
    except Exception as e:
        print(f"Error: {e}")
