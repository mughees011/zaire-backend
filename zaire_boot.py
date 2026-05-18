import os
import sys
import json
import requests
import platform
import tkinter as tk
from tkinter import messagebox
from datetime import datetime, timedelta
from machine_id import generate_machine_fingerprint

# Paths configuration
ZAIRE_DIR = os.path.join(os.path.expanduser("~"), ".zaire")
LICENSE_FILE = os.path.join(ZAIRE_DIR, "license.json")
BACKEND_URL = "http://127.0.0.1:3001" # local dev server fallback

def ensure_zaire_dir():
    if not os.path.exists(ZAIRE_DIR):
        os.makedirs(ZAIRE_DIR, exist_ok=True)

def load_cached_license():
    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print("[BOOT] Failed to read cached license:", e)
    return None

def save_license_cache(key, plan, email, expiry):
    ensure_zaire_dir()
    try:
        data = {
            "key": key,
            "plan": plan,
            "email": email,
            "expiry": expiry,
            "last_validated": datetime.now().isoformat()
        }
        with open(LICENSE_FILE, 'w') as f:
            json.dump(data, f, indent=4)
        print("[BOOT] License cached successfully.")
    except Exception as e:
        print("[BOOT] Failed to write license cache:", e)

def validate_license_online(key):
    """Hits the local or production backend validate endpoint."""
    print(f"[BOOT] Performing online validation for key: {key}...")
    try:
        payload = {
            "license_key": key,
            "machine_id": generate_machine_fingerprint(),
            "machine_name": platform.node(),
            "os_version": f"{platform.system()} {platform.release()}"
        }
        response = requests.post(
            f"{BACKEND_URL}/api/license/validate",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=8
        )
        if response.status_code == 200:
            return response.json()
        else:
            return {"valid": False, "error": f"HTTP_{response.status_code}"}
    except Exception as e:
        print("[BOOT] Online validation failed with exception:", str(e))
        return {"valid": False, "error": "CONNECTION_FAILED"}

def handle_offline_validation(cached):
    """Allows running offline for 7 days since last successful validation."""
    if not cached or "last_validated" not in cached:
        return {"valid": False, "error": "NO_CACHE_FOUND"}
    
    try:
        last_val = datetime.fromisoformat(cached["last_validated"])
        if datetime.now() - last_val < timedelta(days=7):
            print(f"[BOOT] Offline mode activated. Last online check: {last_val.strftime('%Y-%m-%d')}")
            return {
                "valid": True,
                "plan": cached.get("plan", "pro"),
                "email": cached.get("email", "offline@zaire.ai"),
                "expiry": cached.get("expiry"),
                "offline": True
            }
    except Exception as e:
        print("[BOOT] Offline validation error:", e)
    
    return {"valid": False, "error": "OFFLINE_LIMIT_EXCEEDED"}

def check_license_and_boot():
    """Main verification cycle."""
    cached = load_cached_license()
    if cached:
        # 1. Attempt online verification
        result = validate_license_online(cached["key"])
        if result.get("valid"):
            save_license_cache(
                cached["key"], 
                result.get("plan", "pro"), 
                result.get("user_email", cached.get("email")),
                result.get("expiry")
            )
            print("[BOOT] License verified online. Launching ZAIRE...")
            return True, result
        
        # 2. Connection failed? Fallback to offline grace period
        if result.get("error") == "CONNECTION_FAILED":
            offline_res = handle_offline_validation(cached)
            if offline_res.get("valid"):
                print("[BOOT] Offline grace accepted. Launching ZAIRE...")
                return True, offline_res
            
    # 3. No valid license -> launch UI entry screen
    return False, None

class ZaireBootPortal:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ZAIRE — Security Portal")
        self.root.geometry("540x350")
        self.root.configure(bg='#000810')
        self.root.resizable(False, False)
        
        # Center the window
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (540 // 2)
        y = (screen_height // 2) - (350 // 2)
        self.root.geometry(f"540x350+{x}+{y}")
        
        self.success = False
        self.result_data = None
        self.setup_ui()
        
    def setup_ui(self):
        # Premium HUD border overlay
        border_frame = tk.Frame(self.root, bg='#00f2ff', bd=1)
        border_frame.place(relx=0.05, rely=0.05, relwidth=0.9, relheight=0.9)
        
        inner_frame = tk.Frame(border_frame, bg='#000c18')
        inner_frame.place(relwidth=1.0, relheight=1.0, x=0, y=0)
        
        # Header / Title
        title_label = tk.Label(
            inner_frame, 
            text="ZAIRE SOVEREIGN SPHERE", 
            fg='#00f2ff', 
            bg='#000c18', 
            font=('Courier New', 16, 'bold')
        )
        title_label.pack(pady=(25, 5))
        
        subtitle_label = tk.Label(
            inner_frame, 
            text="CORE SECURITY & LICENSING VERIFICATION", 
            fg='#0088cc', 
            bg='#000c18', 
            font=('Courier New', 10)
        )
        subtitle_label.pack(pady=(0, 20))
        
        # Instruction
        inst_label = tk.Label(
            inner_frame, 
            text="ENTER ACTIVATION LICENSE KEY", 
            fg='#ffffff', 
            bg='#000c18', 
            font=('Courier New', 10, 'bold')
        )
        inst_label.pack(pady=5)
        
        # License key entry
        self.entry_var = tk.StringVar()
        self.entry = tk.Entry(
            inner_frame,
            textvariable=self.entry_var,
            font=('Courier New', 12, 'bold'),
            bg='#001528',
            fg='#00f2ff',
            insertbackground='#00f2ff',
            bd=1,
            relief='solid',
            justify='center',
            width=36
        )
        self.entry.pack(pady=10)
        self.entry.insert(0, "ZAIRE-")
        
        # Status message area
        self.status_label = tk.Label(
            inner_frame,
            text="System state: LOCKED",
            fg='#ff3333',
            bg='#000c18',
            font=('Courier New', 9, 'italic')
        )
        self.status_label.pack(pady=5)
        
        # Button
        self.btn = tk.Button(
            inner_frame,
            text="VERIFY & DEPLOY NEURAL CORES",
            command=self.perform_activation,
            font=('Courier New', 10, 'bold'),
            bg='#00f2ff',
            fg='#000000',
            activebackground='#00b3c0',
            activeforeground='#000000',
            bd=0,
            cursor='hand2',
            pady=8,
            padx=20
        )
        self.btn.pack(pady=(15, 10))
        
    def perform_activation(self):
        key = self.entry_var.get().strip()
        if not key or key == "ZAIRE-":
            self.status_label.config(text="ERROR: LICENSE KEY REQUIRED", fg="#ff3333")
            return
            
        self.status_label.config(text="COMMUNICATING WITH SECURITY DEPLOYMENT SERVER...", fg="#00f2ff")
        self.root.update()
        
        res = validate_license_online(key)
        if res.get("valid"):
            save_license_cache(
                key, 
                res.get("plan", "pro"), 
                res.get("user_email", "user@zaire.ai"),
                res.get("expiry")
            )
            self.status_label.config(text="AUTHENTICATION CORES DEPLOYED. LAUNCHING PORTAL...", fg="#00ff66")
            self.root.update()
            
            self.success = True
            self.result_data = res
            self.root.after(1200, self.root.destroy)
        else:
            err = res.get("error", "VALIDATION_FAILED")
            msg = "INVALID OR INACTIVE KEY"
            if err == "CONNECTION_FAILED":
                msg = "SECURE SERVER UNREACHABLE - CHECK NETWORK"
            elif err == "MACHINE_LIMIT_REACHED":
                msg = "DEVICE LIMIT EXCEEDED. MANAGE DASHBOARD"
            elif err == "SUBSCRIPTION_EXPIRED":
                msg = "LICENSE EXPIRED. RENEW PLAN"
                
            self.status_label.config(text=f"FAIL: {msg}", fg="#ff3333")
            messagebox.showerror("ZAIRE Authorization Failure", f"Authentication failed: {msg}")

    def run(self):
        self.root.mainloop()
        return self.success, self.result_data

def run_boot_sequence():
    """Launches the boot sequence and returns boot state."""
    ok, data = check_license_and_boot()
    if ok:
        return True, data
    
    # Launch beautiful UI portal
    portal = ZaireBootPortal()
    return portal.run()

if __name__ == '__main__':
    ok, data = run_boot_sequence()
    if ok:
        print("[BOOT] Activation Successful! Starting ZAIRE. Details:", data)
        sys.exit(0)
    else:
        print("[BOOT] Activation Terminated by User.")
        sys.exit(1)
