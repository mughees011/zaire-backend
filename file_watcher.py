"""
ZAIRE File Watcher & Auto-Organizer — Tier 2 Brain Upgrade (#7)
Flask sidecar on port 3008.

Monitors Downloads folder + Desktop in real time using watchdog.
When a new file appears:
  1. Classifies it (PDF, Code, Image, Video, Document, etc.)
  2. Pushes a smart notification to the ZAIRE frontend
  3. For PDFs → asks if user wants it added to Professor study queue
  4. For code files → asks if user wants Engineer mode to open it
  5. Optionally moves files to organized folders automatically

Install: pip install watchdog flask flask-cors
"""

import os
import sys
import time
import json
import shutil
import threading
from datetime import datetime
from pathlib import Path

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError as e:
    print(f"[FILE_WATCHER] Missing: {e}")
    print("Run: pip install watchdog flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

# ─── Config ──────────────────────────────────────────────────────────────────
HOME         = Path.home()
WATCH_DIRS   = [
    str(HOME / "Downloads"),
    str(HOME / "Desktop")
]
ZAIRE_BACKEND  = "http://127.0.0.1:3001"
STUDY_QUEUE  = str(HOME / "ZAIRE_Study_Queue")   # auto-created folder

# ─── File Classification ──────────────────────────────────────────────────────
FILE_CATEGORIES = {
    "study":    [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".epub", ".txt", ".md"],
    "code":     [".py", ".js", ".ts", ".html", ".css", ".java", ".cpp", ".c",
                 ".cs", ".go", ".rs", ".json", ".yaml", ".yml", ".sh", ".ps1",
                 ".ipynb", ".r", ".sql"],
    "image":    [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp", ".ico"],
    "video":    [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm"],
    "audio":    [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"],
    "archive":  [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
    "data":     [".csv", ".xlsx", ".xls", ".parquet", ".db", ".sqlite"],
    "model":    [".pt", ".pth", ".h5", ".onnx", ".pkl", ".joblib", ".weights"],
}

CATEGORY_ICONS = {
    "study":   "📚",
    "code":    "💻",
    "image":   "🖼️",
    "video":   "🎬",
    "audio":   "🎵",
    "archive": "📦",
    "data":    "📊",
    "model":   "🤖",
    "unknown": "📄"
}

CATEGORY_MESSAGES = {
    "study":   lambda f: f"New study material detected: '{f}'. Want me to add it to your Professor study queue?",
    "code":    lambda f: f"New code file detected: '{f}'. Want me to open it in Engineer mode?",
    "data":    lambda f: f"New dataset detected: '{f}'. Want me to analyze it with Engineer mode?",
    "model":   lambda f: f"New AI model file detected: '{f}'. Want me to load it or analyze its structure?",
    "image":   lambda f: f"New image saved: '{f}'. Want me to describe or analyze it?",
    "archive": lambda f: f"New archive downloaded: '{f}'. Want me to tell you what's inside?",
    "unknown": lambda f: f"New file appeared: '{f}'.",
}

# ─── State ───────────────────────────────────────────────────────────────────
recent_events:  list[dict] = []
observer:       Observer | None = None
study_queue:    list[str] = []

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _classify_file(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    for cat, exts in FILE_CATEGORIES.items():
        if ext in exts:
            return cat
    return "unknown"


def _push_event(event: dict):
    """Send file event to Node.js backend."""
    try:
        import requests
        requests.post(
            f"{ZAIRE_BACKEND}/files/event",
            json=event,
            timeout=2
        )
    except Exception:
        pass


def _add_to_study_queue(filepath: str):
    """Copy file to ZAIRE study queue folder."""
    try:
        os.makedirs(STUDY_QUEUE, exist_ok=True)
        dest = os.path.join(STUDY_QUEUE, Path(filepath).name)
        shutil.copy2(filepath, dest)
        study_queue.append(dest)
        print(f"[FILE_WATCHER] Added to study queue: {Path(filepath).name}")
        return dest
    except Exception as e:
        print(f"[FILE_WATCHER] Study queue error: {e}")
        return None


# ─── Watchdog Event Handler ───────────────────────────────────────────────────

class ZaireFileHandler(FileSystemEventHandler):

    # Ignore temp files, partial downloads, system files
    IGNORE_PATTERNS = [".tmp", ".crdownload", ".part", ".download",
                       "~", ".lnk", "desktop.ini", "thumbs.db"]

    def _should_ignore(self, path: str) -> bool:
        name = Path(path).name.lower()
        return any(p in name for p in self.IGNORE_PATTERNS)

    def on_created(self, event):
        if event.is_directory:
            return
        filepath = event.src_path
        if self._should_ignore(filepath):
            return

        # Small delay — wait for file to finish writing
        time.sleep(1.5)
        if not os.path.exists(filepath):
            return

        filename = Path(filepath).name
        category = _classify_file(filepath)
        icon     = CATEGORY_ICONS.get(category, "📄")

        # Build the smart message
        msg_fn  = CATEGORY_MESSAGES.get(category, CATEGORY_MESSAGES["unknown"])
        message = msg_fn(filename)

        # Get file size
        try:
            size_kb = round(os.path.getsize(filepath) / 1024, 1)
        except Exception:
            size_kb = 0

        event_data = {
            "type":      "FILE_CREATED",
            "category":  category,
            "icon":      icon,
            "filepath":  filepath,
            "filename":  filename,
            "size_kb":   size_kb,
            "message":   message,
            "timestamp": datetime.now().isoformat(),
            "watch_dir": str(Path(filepath).parent)
        }

        # Auto-add to study queue for study materials
        if category == "study":
            queued = _add_to_study_queue(filepath)
            if queued:
                event_data["queued_path"] = queued

        recent_events.insert(0, event_data)
        if len(recent_events) > 50:
            recent_events.pop()

        print(f"[FILE_WATCHER] {icon} {category.upper()}: {filename} ({size_kb}KB)")
        _push_event(event_data)

    def on_moved(self, event):
        """Also detect files moved into watched directories."""
        if event.is_directory:
            return
        self.on_created(type('E', (), {'src_path': event.dest_path, 'is_directory': False})())


# ─── Watcher Control ─────────────────────────────────────────────────────────

def _start_observer():
    global observer
    handler  = ZaireFileHandler()
    observer = Observer()

    valid_dirs = [d for d in WATCH_DIRS if os.path.isdir(d)]
    for d in valid_dirs:
        observer.schedule(handler, d, recursive=False)
        print(f"[FILE_WATCHER] Watching: {d}")

    observer.start()
    print(f"[FILE_WATCHER] Observer started — monitoring {len(valid_dirs)} directories.")


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/files/events", methods=["GET"])
def get_events():
    """Return recent file events."""
    limit = int(request.args.get("limit", 20))
    return jsonify({"success": True, "events": recent_events[:limit]})


@app.route("/files/study_queue", methods=["GET"])
def get_study_queue():
    """Return all files currently in the study queue."""
    queue_items = []
    if os.path.isdir(STUDY_QUEUE):
        for fname in os.listdir(STUDY_QUEUE):
            fp = os.path.join(STUDY_QUEUE, fname)
            queue_items.append({
                "filename": fname,
                "path":     fp,
                "size_kb":  round(os.path.getsize(fp) / 1024, 1) if os.path.isfile(fp) else 0
            })
    return jsonify({"success": True, "queue": queue_items, "queue_dir": STUDY_QUEUE})


@app.route("/files/add_to_queue", methods=["POST"])
def add_to_queue():
    """Manually add a file to the study queue."""
    data     = request.get_json()
    filepath = data.get("filepath", "")
    if not os.path.exists(filepath):
        return jsonify({"success": False, "error": "File not found."}), 404
    dest = _add_to_study_queue(filepath)
    return jsonify({"success": bool(dest), "queued_path": dest})


@app.route("/files/clear_queue", methods=["POST"])
def clear_queue():
    """Clear the study queue."""
    try:
        if os.path.isdir(STUDY_QUEUE):
            shutil.rmtree(STUDY_QUEUE)
        os.makedirs(STUDY_QUEUE)
        study_queue.clear()
        return jsonify({"success": True, "message": "Study queue cleared."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/files/organize", methods=["POST"])
def organize_downloads():
    """
    Move all files in Downloads into categorized subfolders.
    Body: { "dry_run": true }  → just preview, don't move
    """
    data    = request.get_json() or {}
    dry_run = data.get("dry_run", True)
    dl_dir  = str(HOME / "Downloads")
    results = []

    for fname in os.listdir(dl_dir):
        fp = os.path.join(dl_dir, fname)
        if os.path.isfile(fp):
            cat  = _classify_file(fp)
            dest = os.path.join(dl_dir, cat.capitalize(), fname)
            results.append({"file": fname, "category": cat, "destination": dest})
            if not dry_run:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.move(fp, dest)

    return jsonify({
        "success": True,
        "dry_run": dry_run,
        "moved":   len(results),
        "results": results
    })


@app.route("/files/classify", methods=["POST"])
def classify_file():
    """Classify a specific file."""
    data     = request.get_json()
    filepath = data.get("filepath", "")
    cat      = _classify_file(filepath)
    return jsonify({
        "success":  True,
        "filepath": filepath,
        "category": cat,
        "icon":     CATEGORY_ICONS.get(cat, "📄")
    })


@app.route("/files/watched_dirs", methods=["GET"])
def watched_dirs():
    return jsonify({
        "success": True,
        "dirs":    WATCH_DIRS,
        "active":  [d for d in WATCH_DIRS if os.path.isdir(d)]
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":      "ok",
        "service":     "zaire-file-watcher",
        "watching":    [d for d in WATCH_DIRS if os.path.isdir(d)],
        "queue_count": len(os.listdir(STUDY_QUEUE)) if os.path.isdir(STUDY_QUEUE) else 0
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE File Watcher & Auto-Organizer")
    print("  Flask server on port 3008")
    print("==============================================\n")

    os.makedirs(STUDY_QUEUE, exist_ok=True)
    _start_observer()

    try:
        app.run(host="127.0.0.1", port=3008, debug=False, use_reloader=False)
    finally:
        if observer:
            observer.stop()
            observer.join()
