import os
import sys
import importlib.util

specialists_dir = r"c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend\specialists"
sys.path.append(r"c:\Users\Mughees Siddiqui\Pictures\Mughees-Tony\backend")

files = [f for f in os.listdir(specialists_dir) if f.endswith(".py") and not f.startswith("__")]

print(f"Checking {len(files)} specialists...")

for f in files:
    name = f[:-3]
    path = os.path.join(specialists_dir, f)
    print(f"Testing {name}...", end=" ")
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")
