import json
import os
import platform
import subprocess
import sys
import tkinter as tk
import time
import webbrowser
from datetime import datetime, timedelta
from tkinter import messagebox

import requests

from machine_id import generate_machine_fingerprint

try:
    import winsound
except ImportError:
    winsound = None


def default_zaire_dir():
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return os.path.join(base, "ZAIRE")
    return os.path.join(os.path.expanduser("~"), ".zaire")


ZAIRE_DIR = default_zaire_dir()
SESSION_FILE = os.path.join(ZAIRE_DIR, "session.json")
LEGACY_ZAIRE_DIR = os.path.join(os.path.expanduser("~"), ".zaire")
LEGACY_LICENSE_FILE = os.path.join(LEGACY_ZAIRE_DIR, "license.json")
BACKEND_URL = "http://localhost:10000"
LOCAL_APP_URL = "http://127.0.0.1:10000"
APP_VERSION = "1.0"
DEFAULT_WORKSPACE_STATUS = {
    "projects": 12,
    "repositories": 8,
    "deployments": 4,
    "agents_available": 7,
    "active_workspaces": 4,
}
STATUS_MESSAGES = [
    "Building Cognitive Map...",
    "Loading Project Memory...",
    "Synchronizing Agent Workspace...",
    "Preparing Engineering Environment...",
    "Initializing Sovereign Runtime...",
]
STATUS_FEED_MESSAGES = [
    "[READY] Memory Vault Loaded",
    "[READY] Security Layer Online",
    "[READY] Engineer Systems Initialized",
    "[SYNC] Agent Workspace Linked",
    "[LIVE] Sovereign Runtime Standing By",
]
CORE_SYSTEMS = [
    "Memory Engine",
    "Voice Systems",
    "Neural Runtime",
    "Security Layer",
    "Local Workspace",
    "Engineer Systems",
]


def draw_splash_sphere(canvas, cx, cy, shell_radius, core_radius, phase=0.0, center_text="Z", center_font=28):
    sweep = (phase * 210) % 360
    halo_radius = shell_radius + 26
    outer_radius = shell_radius + 8
    core_glow_radius = max(core_radius - 10, 10)

    canvas.create_oval(
        cx - halo_radius, cy - halo_radius, cx + halo_radius, cy + halo_radius,
        outline="#08283a", width=1
    )
    canvas.create_oval(
        cx - outer_radius, cy - outer_radius, cx + outer_radius, cy + outer_radius,
        outline="#0b3952", width=1
    )
    canvas.create_arc(
        cx - halo_radius - 2, cy - halo_radius - 2, cx + halo_radius + 2, cy + halo_radius + 2,
        start=int(sweep), extent=86, outline="#00d4ff", style="arc", width=3
    )
    canvas.create_arc(
        cx - outer_radius, cy - outer_radius, cx + outer_radius, cy + outer_radius,
        start=int((sweep + 154) % 360), extent=56, outline="#7cf5ff", style="arc", width=2
    )
    canvas.create_oval(
        cx - shell_radius, cy - shell_radius, cx + shell_radius, cy + shell_radius,
        outline="#00a9ff", width=2
    )
    canvas.create_oval(
        cx - core_radius, cy - core_radius, cx + core_radius, cy + core_radius,
        fill="#0676d8", outline=""
    )
    canvas.create_oval(
        cx - core_glow_radius, cy - core_glow_radius, cx + core_glow_radius, cy + core_glow_radius,
        fill="#18b7e8", outline=""
    )
    canvas.create_oval(
        cx - max(core_glow_radius - 18, 8), cy - max(core_glow_radius - 18, 8),
        cx + max(core_glow_radius - 18, 8), cy + max(core_glow_radius - 18, 8),
        fill="#57e4f0", outline=""
    )
    canvas.create_text(cx, cy, text=center_text, fill="#02101b", font=("Courier New", center_font, "bold"))


def draw_rounded_outline(canvas, width, height, radius=26, color="#1733a8", line_width=2):
    canvas.delete("frame")
    x1 = line_width
    y1 = line_width
    x2 = max(x1 + 2, width - line_width)
    y2 = max(y1 + 2, height - line_width)
    r = max(6, min(radius, (x2 - x1) // 4, (y2 - y1) // 4))

    canvas.create_line(x1 + r, y1, x2 - r, y1, fill=color, width=line_width, tags="frame")
    canvas.create_line(x1 + r, y2, x2 - r, y2, fill=color, width=line_width, tags="frame")
    canvas.create_line(x1, y1 + r, x1, y2 - r, fill=color, width=line_width, tags="frame")
    canvas.create_line(x2, y1 + r, x2, y2 - r, fill=color, width=line_width, tags="frame")

    canvas.create_arc(x1, y1, x1 + 2 * r, y1 + 2 * r, start=90, extent=90, style="arc", outline=color, width=line_width, tags="frame")
    canvas.create_arc(x2 - 2 * r, y1, x2, y1 + 2 * r, start=0, extent=90, style="arc", outline=color, width=line_width, tags="frame")
    canvas.create_arc(x1, y2 - 2 * r, x1 + 2 * r, y2, start=180, extent=90, style="arc", outline=color, width=line_width, tags="frame")
    canvas.create_arc(x2 - 2 * r, y2 - 2 * r, x2, y2, start=270, extent=90, style="arc", outline=color, width=line_width, tags="frame")


def backend_url_confirmed():
    return BACKEND_URL != "https://confirm-before-launch.example"


def ensure_zaire_dir():
    if not os.path.exists(ZAIRE_DIR):
        os.makedirs(ZAIRE_DIR, exist_ok=True)


def load_json_file(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as exc:
        print(f"[BOOT] Failed to read {path}: {exc}")
        return None


def save_json_file(path, data):
    ensure_zaire_dir()
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


def infer_display_name(email="", fallback="Builder"):
    if email and "@" in email:
        base = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
        if base:
            return " ".join(part.capitalize() for part in base.split())
    return fallback


def machine_payload():
    return {
        "machine_id": generate_machine_fingerprint(),
        "machine_name": platform.node() or "ZAIRE Workstation",
        "os_version": f"{platform.system()} {platform.release()}",
    }


def mask_license_key(license_key):
    if not license_key:
        return "FREE-ACCESS"
    parts = license_key.split("-")
    if len(parts) >= 3:
        return f"{parts[0]}-XXXX-XXXX-{parts[-1]}"
    if len(license_key) > 8:
        return f"{license_key[:4]}-XXXX-{license_key[-4:]}"
    return license_key


def now_iso():
    return datetime.now().isoformat()


def format_relative_session(timestamp):
    if not timestamp:
        return "No prior session"
    try:
        previous = datetime.fromisoformat(timestamp)
        delta = datetime.now() - previous
        hours = max(1, int(delta.total_seconds() // 3600))
        return f"{hours} hours ago"
    except Exception:
        return timestamp


def normalize_workspace_status(payload):
    status = dict(DEFAULT_WORKSPACE_STATUS)
    status.update(payload or {})
    return status


def build_session_record(payload):
    current_machine = machine_payload()
    email = payload.get("user_email") or payload.get("email") or "free@zaire.local"
    display_name = payload.get("display_name") or infer_display_name(email, "Builder")
    license_key = payload.get("license_key") or payload.get("key") or ""
    plan = (payload.get("plan") or "free").lower()
    license_status = payload.get("license_status")
    if not license_status:
        license_status = "Activated" if license_key and plan != "free" else "Free Access"

    session = {
        "version": APP_VERSION,
        "display_name": display_name,
        "email": email,
        "plan": plan,
        "license_key": license_key,
        "license_id_masked": mask_license_key(license_key),
        "license_status": license_status,
        "expiry": payload.get("expiry"),
        "current_period_end": payload.get("current_period_end") or payload.get("expiry"),
        "last_validated": payload.get("last_validated") or now_iso(),
        "last_session_at": payload.get("last_session_at") or now_iso(),
        "machine_id": payload.get("machine_id") or current_machine["machine_id"],
        "machine_name": payload.get("machine_name") or current_machine["machine_name"],
        "os_version": payload.get("os_version") or current_machine["os_version"],
        "workspace_status": normalize_workspace_status(payload.get("workspace_status")),
        "mode": payload.get("mode") or "ENGINEER MODE READY",
        "status": payload.get("status") or "READY",
        "features": payload.get("features") or [],
        "access_mode": payload.get("access_mode") or ("pro" if license_key and plan != "free" else "free"),
        "free_tier": plan == "free",
    }
    return session


def save_session_cache(session):
    session["last_session_at"] = now_iso()
    session["last_validated"] = session.get("last_validated") or now_iso()
    save_json_file(SESSION_FILE, session)
    if session.get("license_key"):
        legacy_cache = {
            "key": session["license_key"],
            "plan": session.get("plan"),
            "email": session.get("email"),
            "expiry": session.get("expiry"),
            "last_validated": session.get("last_validated"),
        }
        save_json_file(LEGACY_LICENSE_FILE, legacy_cache)


def migrate_legacy_license():
    legacy = load_json_file(LEGACY_LICENSE_FILE)
    if not legacy:
        return None
    migrated = build_session_record(
        {
            "license_key": legacy.get("key"),
            "plan": legacy.get("plan", "pro"),
            "email": legacy.get("email", "offline@zaire.ai"),
            "expiry": legacy.get("expiry"),
            "last_validated": legacy.get("last_validated"),
            "license_status": "Activated",
            "access_mode": "pro",
        }
    )
    save_session_cache(migrated)
    return migrated


def load_cached_session():
    session = load_json_file(SESSION_FILE)
    if session:
        return session
    return migrate_legacy_license()


def play_ui_sound(kind):
    if winsound is None:
        return
    try:
        if kind == "click":
            winsound.Beep(1180, 30)
        elif kind == "ready":
            winsound.Beep(1320, 45)
            winsound.Beep(1680, 60)
        else:
            winsound.Beep(980, 40)
    except Exception:
        pass


def app_runtime_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def local_runtime_is_ready(timeout=2):
    try:
        response = requests.get(LOCAL_APP_URL, timeout=timeout)
        return response.status_code < 500
    except Exception:
        return False


def open_zaire_ui():
    try:
        if os.name == "nt":
            os.startfile(LOCAL_APP_URL)
            return True
        return webbrowser.open(LOCAL_APP_URL)
    except Exception:
        return False


def launch_zaire_runtime():
    if local_runtime_is_ready():
        opened = open_zaire_ui()
        if opened:
            return True, None
        return False, "ZAIRE was already running, but the app window could not be opened."

    runtime_dir = app_runtime_dir()
    backend_entry = os.path.join(runtime_dir, "index.js")

    if not os.path.exists(backend_entry):
        return False, "ZAIRE runtime entry was not found."

    if os.name == "nt":
        bundled_node = os.path.join(runtime_dir, "runtime", "node.exe")
        node_binary = bundled_node if os.path.exists(bundled_node) else "node"
        creation_flags = 0x00000008 | 0x00000200
    else:
        bundled_node = os.path.join(runtime_dir, "runtime", "node")
        node_binary = bundled_node if os.path.exists(bundled_node) else "node"
        creation_flags = 0

    env = os.environ.copy()
    env["ZAIRE_OPEN_UI"] = "1"
    env["RUN_DAEMONS"] = "true"

    try:
        process = subprocess.Popen(
            [node_binary, backend_entry],
            cwd=runtime_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
            start_new_session=os.name != "nt",
        )

        for _ in range(16):
            if process.poll() is not None:
                break
            if local_runtime_is_ready(timeout=1):
                if open_zaire_ui():
                    return True, None
                return False, "ZAIRE started, but the app window could not be opened."
            time.sleep(0.35)

        if process.poll() is not None:
            return False, "ZAIRE runtime exited during startup. Another local instance may already be using the port."

        return False, "ZAIRE runtime did not become ready in time."
    except FileNotFoundError:
        return False, "Node runtime is missing. Rebuild the packaged launcher."
    except Exception as exc:
        return False, str(exc)


def within_offline_grace(last_validated, days=7):
    if not last_validated:
        return False
    try:
        return datetime.now() - datetime.fromisoformat(last_validated) < timedelta(days=days)
    except Exception:
        return False


def post_json(endpoint, payload, timeout=8):
    response = requests.post(
        f"{BACKEND_URL}{endpoint}",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=timeout,
    )
    if response.status_code == 200:
        return response.json()
    return {"valid": False, "error": f"HTTP_{response.status_code}"}


def validate_license_online(license_key):
    print(f"[BOOT] Performing online validation for key: {license_key}...")
    if not backend_url_confirmed():
        return {"valid": False, "error": "BACKEND_URL_UNCONFIRMED"}
    try:
        payload = {"license_key": license_key, **machine_payload()}
        return post_json("/api/license/validate", payload)
    except Exception as exc:
        print("[BOOT] Online validation failed:", exc)
        return {"valid": False, "error": "CONNECTION_FAILED"}


def build_local_free_session(email, display_name):
    return build_session_record(
        {
            "email": email or "free@zaire.local",
            "display_name": display_name or infer_display_name(email, "Builder"),
            "plan": "free",
            "license_status": "Free Access",
            "access_mode": "free",
            "status": "READY",
            **machine_payload(),
        }
    )


def establish_session(email, display_name, license_key=""):
    clean_email = (email or "").strip().lower()
    clean_name = (display_name or "").strip() or infer_display_name(clean_email, "Builder")
    clean_key = (license_key or "").strip().upper()

    if clean_key:
        result = validate_license_online(clean_key)
        if result.get("valid"):
            session = build_session_record(
                {
                    **result,
                    "display_name": clean_name,
                    "email": result.get("user_email") or clean_email or "pro@zaire.ai",
                    "license_status": "Activated",
                    "access_mode": "pro",
                    **machine_payload(),
                }
            )
            save_session_cache(session)
            return {"valid": True, "session": session}
        return result

    if not clean_email:
        clean_email = f"{clean_name.lower().replace(' ', '.')}@zaire.local"

    if not backend_url_confirmed():
        session = build_local_free_session(clean_email, clean_name)
        save_session_cache(session)
        return {"valid": True, "session": session, "offline_free": True}

    try:
        result = post_json(
            "/api/launcher/session",
            {
                "email": clean_email,
                "display_name": clean_name,
                "access_mode": "free",
                **machine_payload(),
            },
        )
        if result.get("valid"):
            session = build_session_record(
                {
                    **result,
                    "display_name": result.get("display_name") or clean_name,
                    "email": result.get("user_email") or clean_email,
                    **machine_payload(),
                }
            )
            save_session_cache(session)
            return {"valid": True, "session": session}
        return result
    except Exception as exc:
        print("[BOOT] Free routing failed, falling back to local free session:", exc)
        session = build_local_free_session(clean_email, clean_name)
        save_session_cache(session)
        return {"valid": True, "session": session, "offline_free": True}


def restore_cached_session():
    cached = load_cached_session()
    if not cached:
        return {"valid": False}

    cached["last_session_at"] = now_iso()

    if cached.get("license_key"):
        if not backend_url_confirmed():
            if within_offline_grace(cached.get("last_validated")):
                return {"valid": True, "session": cached, "offline": True}
            return {"valid": False, "error": "BACKEND_URL_UNCONFIRMED"}

        result = validate_license_online(cached["license_key"])
        if result.get("valid"):
            session = build_session_record(
                {
                    **cached,
                    **result,
                    "display_name": cached.get("display_name") or infer_display_name(cached.get("email"), "Builder"),
                    "email": result.get("user_email") or cached.get("email"),
                    **machine_payload(),
                }
            )
            save_session_cache(session)
            return {"valid": True, "session": session}

        if result.get("error") == "CONNECTION_FAILED" and within_offline_grace(cached.get("last_validated")):
            return {"valid": True, "session": cached, "offline": True}

        return {"valid": False, "error": result.get("error", "VALIDATION_FAILED")}

    save_session_cache(cached)
    return {"valid": True, "session": cached}


class ZaireBootPortal:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ZAIRE - Access Gateway")
        self.root.geometry("1180x700")
        self.root.configure(bg="#030811")
        self.root.resizable(False, False)

        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (1180 // 2)
        y = (screen_height // 2) - (700 // 2)
        self.root.geometry(f"1180x700+{x}+{y}")

        default_name = os.environ.get("USERNAME", "Mughees")
        default_email = f"{default_name.lower().replace(' ', '.')}@zaire.local"
        self.name_var = tk.StringVar(value=default_name)
        self.email_var = tk.StringVar(value=default_email)
        self.license_var = tk.StringVar(value="")
        self.status_var = tk.StringVar(value="Prepare your access profile to enter ZAIRE.")
        self.feed_var = tk.StringVar(value=STATUS_FEED_MESSAGES[0])
        self.result_session = None
        self.cached_session = load_cached_session()
        self.hero_canvas = None
        self.intro_sphere_canvas = None
        self.hero_ring_labels = []
        self.system_status_labels = []
        self.session_summary_label = None
        self.stage_label = None
        self.intro_frame = None
        self.access_frame = None
        self.feed_panel = None
        self.feed_index = 0
        self.hero_tick = 0
        self.intro_reference_image = None

        self.setup_ui()

    def setup_ui(self):
        shell = tk.Frame(self.root, bg="#02101b")
        shell.place(relx=0.04, rely=0.05, relwidth=0.92, relheight=0.9)
        top = tk.Frame(shell, bg="#02101b")
        top.pack(fill="x", padx=28, pady=(24, 12))
        self.top_bar = top

        tk.Label(
            top,
            text="ZAIRE",
            fg="#1733a8",
            bg="#02101b",
            font=("Courier New", 34, "bold"),
        ).pack(side="left")

        top_right = tk.Frame(top, bg="#02101b")
        top_right.pack(side="right")
        tk.Label(
            top_right,
            text="Artificial Intelligence Operating Environment",
            fg="#1733a8",
            bg="#02101b",
            font=("Courier New", 12),
        ).pack(anchor="e")
        tk.Label(
            top_right,
            text=f"Version {APP_VERSION}",
            fg="#1733a8",
            bg="#02101b",
            font=("Courier New", 9),
        ).pack(anchor="e", pady=(4, 0))

        stage_strip = tk.Frame(shell, bg="#04101a", highlightbackground="#1733a8", highlightthickness=1)
        stage_strip.pack(fill="x", padx=28, pady=(0, 12))
        self.stage_strip = stage_strip
        self.stage_label = tk.Label(
            stage_strip,
            text="STAGE 1  /  PRODUCT OVERVIEW",
            fg="#1733a8",
            bg="#04101a",
            font=("Courier New", 9, "bold"),
        )
        self.stage_label.pack(anchor="w", padx=16, pady=10)

        self.intro_frame = tk.Frame(shell, bg="#02101b")
        self.intro_frame.pack(fill="both", expand=True, padx=28, pady=(0, 14))

        intro_panel = tk.Frame(self.intro_frame, bg="#000000", highlightthickness=0)
        intro_panel.pack(fill="both", expand=True)
        self.intro_border_canvas = tk.Canvas(intro_panel, bg="#000000", highlightthickness=0, bd=0)
        self.intro_border_canvas.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.intro_border_canvas.bind("<Configure>", lambda event: draw_rounded_outline(event.widget, event.width, event.height, radius=28, color="#1733a8", line_width=2))
        intro_content = tk.Frame(intro_panel, bg="#000000")
        intro_content.place(relx=0.5, rely=0.16, anchor="n")

        tk.Label(
            intro_content,
            text="Welcome To ZAIRE",
            fg="#ffffff",
            bg="#000000",
            font=("Segoe UI", 29, "bold"),
        ).pack()
        tk.Label(
            intro_content,
            text="AI OPERATING SYSTEM",
            fg="#e6e6e6",
            bg="#000000",
            font=("Segoe UI", 11),
        ).pack(pady=(6, 0))

        intro_actions = tk.Frame(intro_panel, bg="#000000")
        intro_actions.place(relx=0.5, rely=0.43, anchor="center")

        self.next_btn = tk.Button(
            intro_actions,
            text="ENTER ZAIRE",
            command=self.show_access_stage,
            font=("Segoe UI", 13, "bold"),
            bg="#111c9c",
            fg="#ffffff",
            activebackground="#1a28bf",
            activeforeground="#ffffff",
            bd=0,
            padx=20,
            pady=10,
            cursor="hand2",
            width=14,
        )
        self.next_btn.pack(side="left", padx=72)

        sign_in_command = self.restore_session if self.cached_session else self.show_access_stage
        self.quick_continue_btn = tk.Button(
            intro_actions,
            text="Sign-in",
            command=sign_in_command,
            font=("Segoe UI", 13, "bold"),
            bg="#111c9c",
            fg="#ffffff",
            activebackground="#1a28bf",
            activeforeground="#ffffff",
            bd=0,
            padx=20,
            pady=10,
            cursor="hand2",
            width=14,
        )
        self.quick_continue_btn.pack(side="left", padx=72)

        self.intro_sphere_canvas = tk.Canvas(intro_panel, width=980, height=330, bg="#000000", highlightthickness=0)
        self.intro_sphere_canvas.place(relx=0.5, rely=1.0, anchor="s")
        self.draw_intro_sphere(0.0)

        self.access_frame = tk.Frame(shell, bg="#02101b")

        access_panel = tk.Frame(self.access_frame, bg="#000000", highlightthickness=0)
        access_panel.pack(fill="both", expand=True)
        self.access_border_canvas = tk.Canvas(access_panel, bg="#000000", highlightthickness=0, bd=0)
        self.access_border_canvas.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.access_border_canvas.bind("<Configure>", lambda event: draw_rounded_outline(event.widget, event.width, event.height, radius=28, color="#1733a8", line_width=2))

        tk.Label(
            access_panel,
            text="ZAIRE ACCESS",
            fg="#ffffff",
            bg="#000000",
            font=("Segoe UI", 28, "bold"),
        ).place(relx=0.5, rely=0.10, anchor="n")

        tk.Label(
            access_panel,
            text="OPERATOR",
            fg="#f2f2f2",
            bg="#000000",
            font=("Segoe UI", 15),
        ).place(relx=0.31, rely=0.24, anchor="center")

        tk.Label(
            access_panel,
            text="CORE STATUS",
            fg="#f2f2f2",
            bg="#000000",
            font=("Segoe UI", 15),
        ).place(relx=0.69, rely=0.24, anchor="center")

        operator_col = tk.Frame(access_panel, bg="#000000")
        operator_col.place(relx=0.22, rely=0.33, relwidth=0.31, relheight=0.38)
        self.operator_name_field = self.create_access_line_field(operator_col, "Name:", self.name_var)
        self.operator_email_field = self.create_access_line_field(operator_col, "Email:", self.email_var)
        self.operator_license_field = self.create_access_line_field(operator_col, "License:", self.license_var)

        status_col = tk.Frame(access_panel, bg="#000000")
        status_col.place(relx=0.60, rely=0.33, relwidth=0.31, relheight=0.38)
        self.core_status_lines = []
        for _ in range(3):
            row = tk.Frame(status_col, bg="#000000")
            row.pack(fill="x", pady=(0, 18))
            label = tk.Label(row, text="", fg="#d9d9d9", bg="#000000", anchor="w", font=("Segoe UI", 10))
            label.pack(anchor="w", pady=(0, 10))
            line = tk.Frame(row, bg="#f2f2f2", height=2)
            line.pack(fill="x", anchor="w")
            line.pack_propagate(False)
            self.core_status_lines.append(label)

        self.enter_btn = tk.Button(
            access_panel,
            text="ACCESS ZAIRE",
            command=self.launch_access,
            font=("Segoe UI", 17, "bold"),
            bg="#d9d9d9",
            fg="#0f2198",
            activebackground="#f0f0f0",
            activeforeground="#0f2198",
            bd=0,
            padx=26,
            pady=10,
            cursor="hand2",
            width=16,
        )
        self.enter_btn.place(relx=0.5, rely=0.72, anchor="center")

        self.status_label = tk.Label(
            access_panel,
            textvariable=self.status_var,
            fg="#1733a8",
            bg="#000000",
            justify="center",
            anchor="center",
            font=("Segoe UI", 9),
            wraplength=500,
        )
        self.status_label.place(relx=0.5, rely=0.82, anchor="center")

        self.back_btn = tk.Button(
            access_panel,
            text="Back",
            command=self.show_intro_stage,
            font=("Segoe UI", 9),
            bg="#000000",
            fg="#1733a8",
            activebackground="#000000",
            activeforeground="#1733a8",
            bd=0,
            cursor="hand2",
        )
        self.back_btn.place(relx=0.06, rely=0.93, anchor="w")

        self.restore_btn = tk.Button(
            access_panel,
            text="Continue Session" if self.cached_session else "Session Locked",
            command=self.restore_session,
            font=("Segoe UI", 9),
            bg="#000000",
            fg="#1733a8",
            activebackground="#000000",
            activeforeground="#1733a8",
            bd=0,
            cursor="hand2",
        )
        self.restore_btn.place(relx=0.94, rely=0.93, anchor="e")
        if not self.cached_session:
            self.restore_btn.config(state="disabled", fg="#2b3152")

        self.free_btn = None
        self.pro_btn = None
        self.session_summary_label = tk.Label(access_panel, text="", bg="#000000")
        self.session_meta_label = tk.Label(access_panel, text="", bg="#000000")

        self.update_profile_summary()
        self.show_intro_stage()
        self.animate_hero()

    def create_field(self, parent, label, variable):
        tk.Label(
            parent,
            text=label,
            fg="#7ec9ff",
            bg="#02101b",
            font=("Courier New", 9, "bold"),
        ).pack(anchor="w", pady=(0, 6))
        entry = tk.Entry(
            parent,
            textvariable=variable,
            bg="#061726",
            fg="#ffffff",
            insertbackground="#00d4ff",
            relief="flat",
            highlightbackground="#0c3952",
            highlightcolor="#00d4ff",
            highlightthickness=1,
            font=("Courier New", 12),
        )
        entry.pack(fill="x", pady=(0, 14), ipady=8)

    def create_compact_field(self, parent, label, variable, width=24):
        field = tk.Frame(parent, bg="#06111c")
        tk.Label(
            field,
            text=label,
            fg="#7ec9ff",
            bg="#06111c",
            font=("Courier New", 8, "bold"),
        ).pack(anchor="w", pady=(0, 4))
        entry = tk.Entry(
            field,
            textvariable=variable,
            bg="#061726",
            fg="#ffffff",
            insertbackground="#00d4ff",
            relief="flat",
            highlightbackground="#0c3952",
            highlightcolor="#00d4ff",
            highlightthickness=1,
            font=("Courier New", 10),
            width=width,
        )
        entry.pack(fill="x", ipady=6)
        return field

    def create_access_line_field(self, parent, label, variable):
        field = tk.Frame(parent, bg="#000000")
        field.pack(fill="x", pady=(0, 12))

        tk.Label(
            field,
            text=label,
            fg="#f2f2f2",
            bg="#000000",
            anchor="w",
            font=("Segoe UI", 12),
        ).pack(anchor="w")

        entry = tk.Entry(
            field,
            textvariable=variable,
            bg="#000000",
            fg="#ffffff",
            insertbackground="#ffffff",
            relief="flat",
            highlightthickness=0,
            bd=0,
            font=("Segoe UI", 12),
        )
        entry.pack(fill="x", pady=(4, 0), ipady=1)
        tk.Frame(field, bg="#f2f2f2", height=1).pack(fill="x", pady=(2, 0))
        return entry

    def show_intro_stage(self):
        self.stage_label.config(text="STAGE 1  /  PRODUCT OVERVIEW")
        self.access_frame.pack_forget()
        if self.top_bar:
            self.top_bar.pack_forget()
        if self.stage_strip:
            self.stage_strip.pack_forget()
        self.intro_frame.pack(fill="both", expand=True, padx=28, pady=(0, 14))
        self.status_var.set("Welcome to ZAIRE.")

    def show_access_stage(self):
        self.stage_label.config(text="STAGE 2  /  ACCESS PROFILE")
        self.intro_frame.pack_forget()
        if self.top_bar:
            self.top_bar.pack_forget()
        if self.stage_strip:
            self.stage_strip.pack_forget()
        self.access_frame.pack(fill="both", expand=True, padx=28, pady=(0, 14))
        self.status_var.set("Complete your access profile, then press ENTER ZAIRE.")

    def launch_access(self):
        if self.license_var.get().strip():
            self.activate_pro()
            return
        self.continue_free()

    def build_session_meta_text(self):
        if self.cached_session:
            workspace = normalize_workspace_status(self.cached_session.get("workspace_status"))
            return (
                f"Current Plan: {self.cached_session.get('plan', 'free').upper()}\n"
                f"Last Session: {format_relative_session(self.cached_session.get('last_session_at'))}\n"
                f"Projects: {workspace['projects']}\n"
                f"Active Workspaces: {workspace['active_workspaces']}"
            )
        return "Current Plan: FREE\nLast Session: none\nProjects: 0\nActive Workspaces: 0"

    def update_profile_summary(self):
        status_lines = ["READY", "READY", "READY"]
        if self.cached_session:
            plan_text = self.cached_session.get("plan", "free").upper()
            license_text = "Activated" if self.cached_session.get('license_key') else "Free Tier"
            self.name_var.set(self.cached_session.get("display_name", self.name_var.get()))
            self.email_var.set(self.cached_session.get("email", self.email_var.get()))
            status_lines = ["Identity Ready", license_text, f"Plan {plan_text}"]
        else:
            status_lines = ["Identity Ready", "Free Tier", "Plan Starter"]

        for label, text in zip(self.core_status_lines, status_lines):
            label.config(text=text)

    def draw_intro_sphere(self, phase):
        if not self.intro_sphere_canvas:
            return
        self.intro_sphere_canvas.delete("all")
        width = int(self.intro_sphere_canvas.cget("width"))
        height = int(self.intro_sphere_canvas.cget("height"))
        cx = width // 2
        cy = height + 170
        shell_radius = 330 + int(8 * phase)
        core_radius = 286 + int(5 * phase)

        self.intro_sphere_canvas.create_arc(
            cx - shell_radius - 30,
            cy - shell_radius - 30,
            cx + shell_radius + 30,
            cy + shell_radius + 30,
            start=int((phase * 220) % 360),
            extent=88,
            outline="#1236ff",
            style="arc",
            width=3,
        )
        self.intro_sphere_canvas.create_arc(
            cx - shell_radius - 8,
            cy - shell_radius - 8,
            cx + shell_radius + 8,
            cy + shell_radius + 8,
            start=int(((phase * 220) + 154) % 360),
            extent=58,
            outline="#3ea7ff",
            style="arc",
            width=2,
        )
        self.intro_sphere_canvas.create_oval(
            cx - shell_radius,
            cy - shell_radius,
            cx + shell_radius,
            cy + shell_radius,
            fill="#0a16a8",
            outline="",
        )
        self.intro_sphere_canvas.create_oval(
            cx - core_radius,
            cy - core_radius,
            cx + core_radius,
            cy + core_radius,
            fill="#1122cf",
            outline="",
        )

        for row in range(14):
            for col in range(22):
                px = cx - 280 + (col * 26) + ((row % 2) * 13)
                py = cy - 520 + (row * 22)
                if ((px - cx) ** 2) + ((py - cy) ** 2) < (core_radius - 12) ** 2:
                    self.intro_sphere_canvas.create_polygon(
                        px, py - 5,
                        px + 5, py - 2,
                        px + 5, py + 3,
                        px, py + 6,
                        px - 5, py + 3,
                        px - 5, py - 2,
                        outline="#1d4bff",
                        fill="",
                        width=1,
                    )

        for idx in range(120):
            px = cx - 250 + ((idx * 37) % 500)
            py = cy - 500 + ((idx * 53) % 260)
            if ((px - cx) ** 2) + ((py - cy) ** 2) < (core_radius - 24) ** 2:
                size = 1 if idx % 4 else 2
                self.intro_sphere_canvas.create_oval(
                    px - size,
                    py - size,
                    px + size,
                    py + size,
                    fill="#b7d7ff" if idx % 6 == 0 else "#7ba8ff",
                    outline="",
                )

    def draw_hero_sphere(self, phase):
        if not self.hero_canvas:
            return
        self.hero_canvas.delete("all")
        width = int(self.hero_canvas.cget("width"))
        height = int(self.hero_canvas.cget("height"))
        cx = width // 2
        cy = height + 165
        shell_radius = 240 + int(6 * phase)
        core_radius = 208 + int(4 * phase)

        self.hero_canvas.create_arc(
            cx - shell_radius - 24,
            cy - shell_radius - 24,
            cx + shell_radius + 24,
            cy + shell_radius + 24,
            start=int((phase * 220) % 360),
            extent=88,
            outline="#1236ff",
            style="arc",
            width=2,
        )
        self.hero_canvas.create_arc(
            cx - shell_radius - 6,
            cy - shell_radius - 6,
            cx + shell_radius + 6,
            cy + shell_radius + 6,
            start=int(((phase * 220) + 154) % 360),
            extent=56,
            outline="#3ea7ff",
            style="arc",
            width=2,
        )
        self.hero_canvas.create_oval(
            cx - shell_radius,
            cy - shell_radius,
            cx + shell_radius,
            cy + shell_radius,
            fill="#0a16a8",
            outline="",
        )
        self.hero_canvas.create_oval(
            cx - core_radius,
            cy - core_radius,
            cx + core_radius,
            cy + core_radius,
            fill="#1122cf",
            outline="",
        )

        for row in range(10):
            for col in range(18):
                px = cx - 190 + (col * 22) + ((row % 2) * 11)
                py = cy - 355 + (row * 18)
                if ((px - cx) ** 2) + ((py - cy) ** 2) < (core_radius - 10) ** 2:
                    self.hero_canvas.create_polygon(
                        px, py - 4,
                        px + 4, py - 2,
                        px + 4, py + 2,
                        px, py + 5,
                        px - 4, py + 2,
                        px - 4, py - 2,
                        outline="#1d4bff",
                        fill="",
                        width=1,
                    )

        for idx in range(74):
            px = cx - 170 + ((idx * 29) % 340)
            py = cy - 330 + ((idx * 41) % 180)
            if ((px - cx) ** 2) + ((py - cy) ** 2) < (core_radius - 20) ** 2:
                size = 1 if idx % 4 else 2
                self.hero_canvas.create_oval(
                    px - size,
                    py - size,
                    px + size,
                    py + size,
                    fill="#b7d7ff" if idx % 6 == 0 else "#7ba8ff",
                    outline="",
                )

    def animate_hero(self):
        self.hero_tick += 1
        phase = (self.hero_tick % 120) / 120.0
        self.draw_intro_sphere(phase)
        self.draw_hero_sphere(phase)
        ring_values = [
            f"CPU {48 + (self.hero_tick % 7)}%",
            f"Memory {2.6 + ((self.hero_tick % 5) * 0.1):.1f}G",
            f"Agents {7}",
            "Network LIVE",
        ]
        for label, value in zip(self.hero_ring_labels, ring_values):
            label.config(text=value)
        for index, (dot, state) in enumerate(self.system_status_labels):
            pulse = (self.hero_tick + (index * 10)) % 30 < 18
            dot.config(fg="#00ff88" if pulse else "#0f6c4d")
            state.config(fg="#89ffb6" if pulse else "#4f8c69")
        self.root.after(120, self.animate_hero)

    def animate_feed(self):
        self.feed_var.set(STATUS_FEED_MESSAGES[self.feed_index % len(STATUS_FEED_MESSAGES)])
        self.feed_index += 1
        self.root.after(1600, self.animate_feed)

    def set_busy(self, busy, status_text):
        state = "disabled" if busy else "normal"
        self.enter_btn.config(state=state)
        if self.free_btn:
            self.free_btn.config(state=state)
        if self.pro_btn:
            self.pro_btn.config(state=state)
        self.restore_btn.config(state=state if self.cached_session else "disabled")
        if isinstance(self.next_btn, tk.Button):
            self.next_btn.config(state=state)
        if hasattr(self, "quick_continue_btn") and isinstance(self.quick_continue_btn, tk.Button):
            self.quick_continue_btn.config(state=state)
        self.back_btn.config(state=state)
        self.status_var.set(status_text)
        self.root.update_idletasks()

    def complete(self, session, status_text):
        self.result_session = session
        self.cached_session = session
        self.update_profile_summary()
        self.status_var.set(status_text)
        play_ui_sound("ready")
        self.root.after(260, self.root.destroy)

    def continue_free(self):
        play_ui_sound("click")
        self.set_busy(True, "Routing Free access through engineering workspace authority...")
        result = establish_session(self.email_var.get(), self.name_var.get(), "")
        if result.get("valid"):
            session = result["session"]
            text = "Free route established. Preparing Engineer Edition startup..."
            if result.get("offline_free"):
                text = "Local Free route established. Preparing Engineer Edition startup..."
            self.complete(session, text)
            return
        self.set_busy(False, "Unable to establish Free routing. Please retry.")
        messagebox.showerror("ZAIRE Access", "Free access routing failed.")

    def activate_pro(self):
        play_ui_sound("click")
        license_key = self.license_var.get().strip()
        if not license_key:
            self.status_var.set("Enter your license key only if you want Pro activation.")
            return
        self.set_busy(True, "Authenticating license authority and routing Pro access...")
        result = establish_session(self.email_var.get(), self.name_var.get(), license_key)
        if result.get("valid"):
            self.complete(result["session"], "License verified. Preparing premium startup sequence...")
            return

        self.set_busy(False, "Authentication failed. Review license authority and retry.")
        error_code = result.get("error", "VALIDATION_FAILED")
        error_message = {
            "BACKEND_URL_UNCONFIRMED": "Launch blocked until the production server URL is confirmed.",
            "CONNECTION_FAILED": "Secure server unreachable. Check the network or backend deployment.",
            "MACHINE_LIMIT_REACHED": "This license has reached its device limit.",
            "SUBSCRIPTION_EXPIRED": "This license has expired.",
            "INVALID_KEY": "The supplied license key is invalid.",
        }.get(error_code, f"Authentication failed: {error_code}")
        messagebox.showerror("ZAIRE Pro Activation", error_message)

    def restore_session(self):
        play_ui_sound("click")
        self.set_busy(True, "Restoring your cached ZAIRE session...")
        result = restore_cached_session()
        if result.get("valid"):
            session = result["session"]
            self.complete(session, "Cached session restored. Preparing Engineer Edition startup...")
            return

        self.set_busy(False, "No reusable session is available yet. Continue Free or activate Pro.")
        messagebox.showinfo("ZAIRE Restore", "No cached session could be restored yet.")

    def run(self):
        self.root.mainloop()
        return self.result_session


class StartupSequence:
    def __init__(self, session):
        self.session = session
        self.root = tk.Tk()
        self.root.title("ZAIRE - Startup Sequence")
        self.root.configure(bg="#02070f")
        self.root.resizable(True, True)
        self.root.minsize(980, 680)
        try:
            if os.name == "nt":
                self.root.state("zoomed")
            else:
                self.root.attributes("-zoomed", True)
        except Exception:
            screen_width = self.root.winfo_screenwidth()
            screen_height = self.root.winfo_screenheight()
            self.root.geometry(f"{screen_width}x{screen_height}+0+0")

        self.ready = False
        self.auto_enter_scheduled = False
        self.system_labels = []
        self.progress_fill = None
        self.progress_canvas = None
        self.progress_text = None
        self.status_var = tk.StringVar(value="Calibrating launch shell...")
        self.stage_var = tk.StringVar(value="ZAIRE")
        self.subtitle_var = tk.StringVar(value="Artificial Intelligence Operating Environment")
        self.cta_btn = None
        self.cta_frame = None
        self.hero_title = None
        self.signal_canvas = None
        self.signal_pulse = None
        self.signal_status_label = None
        self.system_feed_label = None
        self.setup_ui()

    def setup_ui(self):
        shell = tk.Frame(self.root, bg="#02070f")
        shell.pack(fill="both", expand=True, padx=34, pady=30)

        top = tk.Frame(shell, bg="#02070f")
        top.pack(fill="x", pady=(0, 8))

        self.hero_title = tk.Label(
            top,
            textvariable=self.stage_var,
            fg="#00e5ff",
            bg="#02070f",
            font=("Courier New", 31, "bold"),
        )
        self.hero_title.pack(anchor="center")

        tk.Label(
            top,
            textvariable=self.subtitle_var,
            fg="#83cfff",
            bg="#02070f",
            font=("Courier New", 12),
        ).pack(anchor="center", pady=(12, 10))

        signal_band = tk.Frame(shell, bg="#02070f")
        signal_band.pack(fill="x", pady=(4, 18))

        self.signal_canvas = tk.Canvas(signal_band, width=240, height=240, bg="#02070f", highlightthickness=0)
        self.signal_canvas.pack(anchor="center")
        self.draw_signal_orb(0.35)

        self.signal_status_label = tk.Label(
            shell,
            text="Sequencing Engineer Mode startup.",
            fg="#9bd9ff",
            bg="#02070f",
            justify="center",
            anchor="center",
            wraplength=720,
            font=("Courier New", 11),
        )
        self.signal_status_label.pack(fill="x", pady=(0, 6))
        self.system_feed_label = tk.Label(
            shell,
            text="[BOOT] Preparing cognitive map",
            fg="#6fa4c1",
            bg="#02070f",
            justify="center",
            anchor="center",
            font=("Courier New", 9),
        )
        self.system_feed_label.pack(fill="x", pady=(0, 18))

        progress_wrap = tk.Frame(shell, bg="#07111d", highlightbackground="#11435f", highlightthickness=1)
        progress_wrap.pack(fill="x", padx=40, pady=(0, 18))

        tk.Label(
            progress_wrap,
            text="AUTHENTICATING LICENSE",
            fg="#ffb24f",
            bg="#07111d",
            font=("Courier New", 10, "bold"),
        ).pack(anchor="w", padx=18, pady=(14, 10))

        self.progress_canvas = tk.Canvas(progress_wrap, height=18, bg="#07111d", highlightthickness=0)
        self.progress_canvas.pack(fill="x", padx=18)
        self.progress_canvas.create_rectangle(0, 4, 980, 14, fill="#091d2d", outline="", tags="track")
        self.progress_fill = self.progress_canvas.create_rectangle(0, 4, 20, 14, fill="#00d4ff", outline="")

        self.progress_text = tk.Label(
            progress_wrap,
            text="0%",
            fg="#9ddfff",
            bg="#07111d",
            font=("Courier New", 9),
        )
        self.progress_text.pack(anchor="e", padx=18, pady=(8, 14))

        content = tk.Frame(shell, bg="#02070f")
        content.pack(fill="both", expand=True)

        left = tk.Frame(content, bg="#06111b", highlightbackground="#11435f", highlightthickness=1)
        left.pack(side="left", fill="both", expand=True, padx=(40, 12))

        right = tk.Frame(content, bg="#06111b", highlightbackground="#11435f", highlightthickness=1)
        right.pack(side="left", fill="both", expand=True, padx=(12, 40))

        tk.Label(
            left,
            text="INITIALIZING CORE SYSTEMS",
            fg="#ffffff",
            bg="#06111b",
            font=("Courier New", 12, "bold"),
        ).pack(anchor="w", padx=18, pady=(18, 8))

        tk.Label(
            left,
            textvariable=self.status_var,
            fg="#77b8d8",
            bg="#06111b",
            font=("Courier New", 10),
            wraplength=320,
            justify="left",
        ).pack(anchor="w", padx=18, pady=(0, 16))

        for item in CORE_SYSTEMS:
            label = tk.Label(
                left,
                text=f"[ ] {item}",
                fg="#48667a",
                bg="#06111b",
                font=("Courier New", 11),
                anchor="w",
            )
            label.pack(fill="x", padx=18, pady=4)
            self.system_labels.append(label)

        self.cta_frame = tk.Frame(right, bg="#06111b")
        self.cta_frame.pack(fill="both", expand=True, padx=18, pady=18)

        tk.Label(
            self.cta_frame,
            text="ENGINEERING COMMAND CENTER",
            fg="#ffb24f",
            bg="#06111b",
            font=("Courier New", 12, "bold"),
        ).pack(anchor="w")

        self.summary_block = tk.Label(
            self.cta_frame,
            text="Authenticating builder profile...",
            fg="#9bd9ff",
            bg="#06111b",
            justify="left",
            anchor="nw",
            font=("Courier New", 10),
        )
        self.summary_block.pack(fill="x", pady=(18, 12))

        self.ready_hint = tk.Label(
            self.cta_frame,
            text="ZAIRE will enter automatically once synchronization completes.",
            fg="#7aa0b7",
            bg="#06111b",
            justify="left",
            anchor="w",
            font=("Courier New", 9),
        )
        self.ready_hint.pack(fill="x", pady=(0, 12))

        self.cta_btn = tk.Button(
            self.cta_frame,
            text="ENTER ZAIRE",
            state="disabled",
            command=self.enter_zaire,
            font=("Courier New", 14, "bold"),
            bg="#00d4ff",
            fg="#02101b",
            activebackground="#72f1ff",
            activeforeground="#02101b",
            bd=0,
            padx=24,
            pady=14,
            cursor="hand2",
        )
        self.cta_btn.pack(side="bottom", fill="x")
        self.root.bind("<Configure>", self.handle_resize)

    def draw_signal_orb(self, scale):
        self.signal_canvas.delete("all")
        draw_splash_sphere(
            self.signal_canvas,
            120,
            120,
            72 + int(14 * scale),
            48 + int(10 * scale),
            phase=scale,
            center_text="Z",
            center_font=30,
        )

    def update_progress_visual(self, value):
        current_width = max(760, self.progress_canvas.winfo_width() or 760)
        width = max(0, min(current_width, int(current_width * value)))
        self.root.update_idletasks()
        self.progress_canvas.coords("track", 0, 4, current_width, 14)
        self.progress_canvas.coords(self.progress_fill, 0, 4, width, 14)
        self.progress_text.config(text=f"{int(value * 100)}%")
        self.draw_signal_orb(0.35 + (value * 0.5))

    def animate_to(self, target, duration_ms):
        current_text = self.progress_text.cget("text").replace("%", "")
        try:
            current = int(current_text) / 100.0
        except Exception:
            current = 0.0
        steps = max(1, duration_ms // 30)
        delta = (target - current) / steps

        def step(count=0, value=current):
            next_value = value + delta
            if count >= steps:
                self.update_progress_visual(target)
                return
            self.update_progress_visual(next_value)
            self.root.after(30, lambda: step(count + 1, next_value))

        step()

    def run(self):
        self.start_sequence()
        self.root.mainloop()
        return self.ready

    def start_sequence(self):
        self.animate_to(0.18, 600)
        self.status_var.set("Building Cognitive Map...")
        self.root.after(900, self.stage_authentication)
        self.root.after(1900, self.stage_license_verified)
        self.root.after(2400, self.stage_systems)
        self.root.after(4200, self.stage_ready)

    def stage_authentication(self):
        play_ui_sound("boot")
        self.stage_var.set("AUTHENTICATING LICENSE")
        access_label = "License Verified" if self.session.get("license_key") else "Routing Free / Pro Access"
        self.subtitle_var.set(access_label)
        self.status_var.set("Synchronizing Agent Workspace...")
        if self.signal_status_label:
            self.signal_status_label.config(text="Verifying identity and access routing.")
        if self.system_feed_label:
            self.system_feed_label.config(text="[AUTH] Operator profile detected")
        self.animate_to(0.42, 700)

    def stage_license_verified(self):
        self.status_var.set("License Verified")
        if self.signal_status_label:
            self.signal_status_label.config(text="License authority accepted.")
        if self.system_feed_label:
            self.system_feed_label.config(text="[READY] License verified")
        self.animate_to(0.58, 500)
        license_line = self.session.get("license_id_masked", "FREE-ACCESS")
        plan_line = self.session.get("plan", "free").upper()
        billing = self.session.get("current_period_end")
        billing_text = "Next Billing: Unlocked locally"
        if billing:
            try:
                billing_text = "Next Billing: " + datetime.fromisoformat(billing.replace("Z", "+00:00")).strftime("%B %d %Y")
            except Exception:
                billing_text = f"Next Billing: {billing}"
        self.summary_block.config(
            text=(
                "LICENSE MANAGEMENT\n\n"
                f"Status: {self.session.get('license_status', 'Activated')}\n"
                f"Plan: {plan_line}\n"
                f"License ID: {license_line}\n"
                f"{billing_text}"
            )
        )

    def stage_systems(self):
        play_ui_sound("click")
        self.stage_var.set("INITIALIZING CORE SYSTEMS")
        self.subtitle_var.set("Preparing Engineering Environment")
        if self.signal_status_label:
            self.signal_status_label.config(text="Initializing core systems.")
        self.animate_to(0.84, 1200)
        for index, label in enumerate(self.system_labels):
            self.root.after(index * 180, lambda current_label=label, idx=index: self.mark_system_ready(current_label, idx))

        def rotate_status(index=0):
            if self.ready:
                return
            current_status = STATUS_MESSAGES[index % len(STATUS_MESSAGES)]
            self.status_var.set(current_status)
            if self.system_feed_label:
                self.system_feed_label.config(text=f"[LIVE] {current_status}")
            self.root.after(320, lambda: rotate_status(index + 1))

        rotate_status()

    def mark_system_ready(self, label, index):
        label.config(text=f"[{chr(10003)}] {CORE_SYSTEMS[index]}", fg="#89ffb6")
        if index in (1, 4):
            play_ui_sound("click")

    def stage_ready(self):
        self.ready = False
        play_ui_sound("ready")
        self.stage_var.set(f"WELCOME BACK {self.session.get('display_name', 'BUILDER').upper()}")
        self.subtitle_var.set(self.session.get("mode", "ENGINEER MODE READY"))
        self.status_var.set("System ready. Engineering command center is synchronized.")
        if self.signal_status_label:
            self.signal_status_label.config(text="Engineer command center ready.")
        if self.system_feed_label:
            self.system_feed_label.config(text="[READY] Systems synchronized")
        self.animate_to(1.0, 400)

        workspace_status = normalize_workspace_status(self.session.get("workspace_status"))
        last_seen = self.session.get("last_session_at")
        last_session_text = "LAST SESSION: JUST NOW"
        if last_seen:
            try:
                previous = datetime.fromisoformat(last_seen)
                delta_hours = max(1, int((datetime.now() - previous).total_seconds() // 3600))
                last_session_text = f"LAST SESSION: {delta_hours} HOURS AGO"
            except Exception:
                pass

        self.summary_block.config(
            text=(
                "ENGINEERING COMMAND CENTER\n\n"
                "Workspace Status\n"
                "------------------------------\n"
                f"Projects: {workspace_status['projects']}\n"
                f"Repositories: {workspace_status['repositories']}\n"
                f"Deployments: {workspace_status['deployments']}\n"
                f"Agents Available: {workspace_status['agents_available']}\n\n"
                "Status: READY\n\n"
                f"{workspace_status['projects']} PROJECTS\n"
                f"{workspace_status['active_workspaces']} ACTIVE WORKSPACES\n"
                f"{last_session_text}"
            )
        )
        self.cta_btn.config(state="normal")
        self.ready_hint.config(text="System ready. Auto-entering ZAIRE...")
        if not self.auto_enter_scheduled:
          self.auto_enter_scheduled = True
          self.root.after(1400, self.enter_zaire)

    def enter_zaire(self):
        play_ui_sound("ready")
        self.ready = True
        self.root.destroy()

    def handle_resize(self, _event=None):
        self.update_progress_visual(min(1.0, max(0.0, float(self.progress_text.cget("text").replace("%", "")) / 100.0)))


def run_boot_sequence():
    restored = restore_cached_session()
    if restored.get("valid"):
        return True, restored["session"]

    portal = ZaireBootPortal()
    session = portal.run()
    if not session:
        return False, None

    return True, session


if __name__ == "__main__":
    ok, data = run_boot_sequence()
    if ok:
        launched, launch_error = launch_zaire_runtime()
        if launched:
            print("[BOOT] Startup Successful! Launching ZAIRE runtime. Details:", data)
            sys.exit(0)
        print("[BOOT] Startup succeeded, but ZAIRE runtime failed to launch:", launch_error)
        messagebox.showerror("ZAIRE Launch Failure", f"Startup completed, but the ZAIRE app did not launch.\n\n{launch_error}")
        sys.exit(1)
    print("[BOOT] Startup terminated by user.")
    sys.exit(1)
