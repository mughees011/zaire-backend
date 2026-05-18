import os
import requests
import json

api_key = "sk-jtuaegzukvmjirujnctmfberfjxobsumibjilbxidltkhzce"
url = "https://api.siliconflow.cn/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
payload = {
    "model": "deepseek-ai/DeepSeek-V3",
    "messages": [
        {"role": "user", "content": "hi"}
    ],
    "temperature": 0.7
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
