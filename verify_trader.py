import ast

with open("specialists/trader.py", "r", encoding="utf-8") as f:
    src = f.read()

# 1. Syntax check
tree = ast.parse(src)
print("PASS: Syntax OK")

# 2. Banned lines gone
banned = [
    "random.random()",
    "rand_factor = random.uniform",
    "composite   = fng_bias + rand_factor",
    "side        = \"BUY\" if composite",
]
found_banned = False
for lineno, line in enumerate(src.splitlines(), 1):
    for b in banned:
        if b in line:
            print(f"FAIL: Still present on line {lineno}: {line.strip()}")
            found_banned = True
if not found_banned:
    print("PASS: All three random decision lines removed")

# 3. _calculate_ta shared helper exists as a method
if "def _calculate_ta(ticker: str)" in src:
    print("PASS: _calculate_ta helper defined")
else:
    print("FAIL: _calculate_ta helper NOT found")

# 4. _calculate_ta called in daemon loop (for per-asset RSI)
if "_calculate_ta(" in src.split("def _apex_daemon_loop")[1]:
    print("PASS: _calculate_ta called inside _apex_daemon_loop")
else:
    print("FAIL: _calculate_ta NOT called inside _apex_daemon_loop")

# 5. Stop-loss check-and-close loop present
# Strip comment lines before checking, to avoid false positives from
# comment text like "# No `import random`" or "# _get_simulated_pulse() is NEVER called"
daemon_body_raw = src.split("def _apex_daemon_loop")[1]
daemon_body = "\n".join(
    line for line in daemon_body_raw.splitlines()
    if not line.lstrip().startswith("#")
)
if "positions_to_close = []" in daemon_body and "current_price <= stop_price" in daemon_body:
    print("PASS: Stop-loss check-and-close loop present in daemon")
else:
    print("FAIL: Stop-loss check-and-close loop MISSING from daemon")

# 6. Simulated pulse never called in daemon body
if "_get_simulated_pulse" not in daemon_body:
    print("PASS: _get_simulated_pulse never called inside daemon loop")
else:
    print("FAIL: _get_simulated_pulse is referenced inside daemon loop")

# 7. import random removed from daemon
if "import random" in daemon_body:
    print("FAIL: 'import random' still inside daemon body")
else:
    print("PASS: 'import random' not present in daemon body")

# 8. BUY/SELL rules are explicit RSI thresholds
if "rsi < 30 and fng_bias > 0" in daemon_body and "rsi > 70 and fng_bias < 0" in daemon_body:
    print("PASS: Explicit RSI<30 BUY and RSI>70 SELL rules present")
else:
    print("FAIL: RSI threshold rules missing from daemon")

print("\n--- Verification complete ---")
