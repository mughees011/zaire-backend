# Weekly Intelligence Briefing Service

"""Generate a weekly PDF briefing and spoken summary for the user.

Features:
- Collect data from various modules (exam results, knowledge graph, goals, business mode, etc.)
- Render a styled PDF using ReportLab
- Generate a short audio summary using pyttsx3 (cross‑platform TTS)
- Expose REST endpoints:
    POST /briefing/generate   -> starts generation, returns job_id
    GET  /briefing/status/<job_id> -> polling for completion, returns PDF/Audio URLs
- Publish `weekly_briefing` events via EventBus for HUD updates
"""

import os, uuid, threading, time, json
from pathlib import Path
from typing import Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS

# Optional EventBus integration
try:
    from backend.event_bus import EventBus
    _bus = EventBus.get_instance()
except Exception:
    _bus = None

# Directory where generated assets are stored (inside the project folder)
ASSET_DIR = Path(__file__).parent / "weekly_briefing_assets"
ASSET_DIR.mkdir(exist_ok=True)

# In‑memory job store: job_id -> {status, pdf_path, audio_path, error}
_jobs: Dict[str, Dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Helper: dummy data collectors (to be replaced by real integrations later)
# ---------------------------------------------------------------------------
def _collect_exam_data():
    # Placeholder – fetch from exam_simulator if needed
    return {"exams_completed": 3, "average_score": 87}

def _collect_knowledge_data():
    return {"new_concepts": 12, "graph_nodes": 45}

def _collect_goal_data():
    try:
        from goal_engine import GoalEngine
        engine = GoalEngine()
        return engine.get_weekly_summary()
    except Exception:
        return {"goals_on_track": 2, "goals_behind": 1}

def _collect_business_data():
    try:
        from specialists.business import BusinessSpecialist
        biz = BusinessSpecialist(None) # we don't need the client just for metrics
        data = biz.get_hud_data().get("metrics", {})
        return {
            "revenue": f"${data.get('revenue_month', 0)}",
            "new_orders": data.get('orders_overnight', 0),
            "followers_gain": data.get('instagram_growth', 0),
            "low_inventory_alerts": [m for m, q in data.get("watch_inventory", {}).items() if q <= 5]
        }
    except Exception:
        return {"revenue": "$1,240", "new_orders": 5, "followers_gain": 23}

# ---------------------------------------------------------------------------
# PDF generation using ReportLab (lightweight but styled)
# ---------------------------------------------------------------------------
def _generate_pdf(report: Dict[str, Any], out_path: Path):
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
        c = canvas.Canvas(str(out_path), pagesize=LETTER)
        width, height = LETTER
        # Header
        c.setFillColor(colors.darkblue)
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2, height - 60, "Weekly Intelligence Briefing")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 12)
        y = height - 100
        for section, data in report.items():
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, y, section.replace('_', ' ').title())
            y -= 20
            c.setFont("Helvetica", 12)
            if isinstance(data, dict):
                for k, v in data.items():
                    c.drawString(70, y, f"{k.replace('_', ' ').title()}: {v}")
                    y -= 15
            else:
                c.drawString(70, y, str(data))
                y -= 15
            y -= 10
        c.showPage()
        c.save()
        return True, None
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# Audio synthesis (simple TTS) using pyttsx3 – works offline
# ---------------------------------------------------------------------------
def _generate_tts(summary: str, out_path: Path):
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.save_to_file(summary, str(out_path))
        engine.runAndWait()
        return True, None
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# Core job runner – runs in a background thread so API remains responsive
# ---------------------------------------------------------------------------
def _run_briefing_job(job_id: str):
    job = _jobs[job_id]
    # Step 1 – collect data
    report = {
        "Exam Summary": _collect_exam_data(),
        "Knowledge Graph": _collect_knowledge_data(),
        "Goal Progress": _collect_goal_data(),
        "Business Overview": _collect_business_data(),
    }
    # Step 2 – generate PDF
    pdf_path = ASSET_DIR / f"{job_id}.pdf"
    ok, err = _generate_pdf(report, pdf_path)
    if not ok:
        job.update({"status": "error", "error": f"PDF generation failed: {err}"})
        return
    # Step 3 – create short textual summary for TTS
    summary_lines = []
    for sec, data in report.items():
        summary_lines.append(f"{sec.replace('_', ' ')}:")
        for k, v in data.items():
            summary_lines.append(f"{k.replace('_', ' ')} {v}")
    summary_text = " ".join(summary_lines)
    audio_path = ASSET_DIR / f"{job_id}.mp3"
    ok, err = _generate_tts(summary_text, audio_path)
    if not ok:
        job.update({"status": "error", "error": f"TTS generation failed: {err}"})
        return
    # Success
    job.update({
        "status": "finished",
        "pdf_path": str(pdf_path),
        "audio_path": str(audio_path),
        "summary": summary_text,
    })
    # Publish UI event (optional)
    if _bus:
        import asyncio
        async def _pub():
            await _bus.publish("weekly_briefing", {"job_id": job_id})
        asyncio.run(_pub())

# ---------------------------------------------------------------------------
# Flask API
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

@app.post("/briefing/generate")
def generate_briefing():
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "created": time.time()}
    threading.Thread(target=_run_briefing_job, args=(job_id,), daemon=True).start()
    return jsonify({"success": True, "job_id": job_id})

@app.get("/briefing/status/<job_id>")
def briefing_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "job not found"}), 404
    return jsonify({
        "success": True,
        "status": job["status"],
        "pdf_url": job.get("pdf_path"),
        "audio_url": job.get("audio_path"),
        "error": job.get("error"),
    })

if __name__ == "__main__":
    print("[BRIEFING] Weekly Intelligence Briefing service listening on 3088")
    app.run(host="127.0.0.1", port=3088, debug=False, use_reloader=False, threaded=True)
