import requests

ports = {
    3001: "/health",
    3002: "/health",
    3004: "/health",
    3005: "/llm/health", # Fixed
    3006: "/health",
    3007: "/health",
    3008: "/health",
    3009: "/health",
    3010: "/health",
    3011: "/health",
    3012: "/health"
}

print("Pinging ZAIRE Ports...")

for port, path in ports.items():
    url = f"http://127.0.0.1:{port}{path}"
    try:
        res = requests.get(url, timeout=2)
        if res.status_code == 200:
            print(f"Port {port}: ONLINE")
        else:
            print(f"Port {port}: ERROR ({res.status_code})")
    except Exception as e:
        print(f"Port {port}: OFFLINE ({e})")
