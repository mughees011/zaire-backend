'''University Exam Simulator – generates timed mock exams, auto‑grades, and produces weakness reports.
Features:
  • POST /exam/generate – create an exam for a given curriculum (uses AirLLM to generate questions).
  • GET  /exam/status   – returns current exam state (remaining time, progress).
  • POST /exam/submit  – submit answers (JSON list of {q_id, answer}).
  • GET  /exam/result   – get graded result and weakness report.
The service stores exams in a global dict keyed by a UUID. It uses a simple threading.Timer to enforce the exam duration.
'''

import uuid, time, threading, json
from pathlib import Path
from typing import Dict, List, Any

from flask import Flask, request, jsonify
from flask_cors import CORS

# Optional EventBus for UI updates (e.g., countdown HUD)
try:
    from backend.event_bus import EventBus
    _bus = EventBus.get_instance()
except Exception:
    _bus = None

# ---------------------------------------------------------------------------
# Simple in‑memory exam store
# ---------------------------------------------------------------------------
_exam_store: Dict[str, Dict] = {}  # exam_id -> {exam_data}

def _create_exam_id() -> str:
    return str(uuid.uuid4())

def _schedule_exam_timeout(exam_id: str, duration_sec: int) -> None:
    def _expire():
        exam = _exam_store.get(exam_id)
        if exam and not exam.get('finished'):
            exam['finished'] = True
            exam['expired'] = True
            # publish event for UI if needed
            if _bus:
                import asyncio
                async def _pub():
                    await _bus.publish('exam_timeout', {'exam_id': exam_id})
                asyncio.run(_pub())
    timer = threading.Timer(duration_sec, _expire)
    timer.start()
    _exam_store[exam_id]['timer'] = timer

# ---------------------------------------------------------------------------
# LLM helper – reuse AirLLM service to generate questions
# ---------------------------------------------------------------------------
def _generate_questions(curriculum: str, num_questions: int = 10) -> List[Dict[str, Any]]:
    # Minimal prompt – the AirLLM service already runs on localhost:3006
    import requests
    prompt = f"Generate a university‑level exam for the AI curriculum '{curriculum}'. Return JSON with exactly {num_questions} questions. Each question must have fields: id (int), type (\"mc\"|\"short\"|\"code\"), prompt (string), options (list of 4 strings, only for mc), answer (string or code snippet)."
    try:
        resp = requests.post('http://127.0.0.1:3006/deep/think', json={'prompt': prompt, 'model': 'deep-think-70b', 'max_tokens': 1024}, timeout=30)
        data = resp.json()
        # Expect the LLM to return a JSON string inside content – try to parse
        content = data.get('content') or data.get('content', '')
        if isinstance(content, str):
            content = json.loads(content)
        return content.get('questions', [])
    except Exception as e:
        print(f'[EXAM] LLM generation failed: {e}')
        # Fallback simple static questions
        return [
            {'id': i+1, 'type': 'mc', 'prompt': f'Sample MC question {i+1}?', 'options': ['A','B','C','D'], 'answer': 'A'}
            for i in range(num_questions)
        ]

# ---------------------------------------------------------------------------
# Flask app exposing the API
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

@app.route('/exam/generate', methods=['POST'])
def generate_exam():
    data = request.get_json() or {}
    curriculum = data.get('curriculum', 'Air University AI')
    duration = int(data.get('duration_seconds', 1800))  # default 30 min
    num_q = int(data.get('num_questions', 10))
    exam_id = _create_exam_id()
    questions = _generate_questions(curriculum, num_q)
    exam_entry = {
        'exam_id': exam_id,
        'curriculum': curriculum,
        'duration_sec': duration,
        'start_ts': time.time(),
        'questions': questions,
        'answers': {},
        'finished': False,
        'expired': False,
    }
    _exam_store[exam_id] = exam_entry
    _schedule_exam_timeout(exam_id, duration)
    return jsonify({'success': True, 'exam_id': exam_id, 'duration_sec': duration, 'questions': [{k: q[k] for k in ('id','type','prompt','options') if k in q} for q in questions]})

@app.route('/exam/status/<exam_id>', methods=['GET'])
def exam_status(exam_id):
    exam = _exam_store.get(exam_id)
    if not exam:
        return jsonify({'success': False, 'error': 'exam not found'}), 404
    remaining = max(0, int(exam['start_ts'] + exam['duration_sec'] - time.time()))
    return jsonify({
        'success': True,
        'finished': exam['finished'],
        'expired': exam.get('expired', False),
        'remaining_seconds': remaining,
        'answered': len(exam['answers']),
        'total': len(exam['questions'])
    })

@app.route('/exam/submit/<exam_id>', methods=['POST'])
def submit_answers(exam_id):
    exam = _exam_store.get(exam_id)
    if not exam:
        return jsonify({'success': False, 'error': 'exam not found'}), 404
    if exam['finished']:
        return jsonify({'success': False, 'error': 'exam already finished'}), 400
    data = request.get_json() or []  # expect list of {q_id, answer}
    for entry in data:
        qid = entry.get('q_id')
        ans = entry.get('answer')
        if qid is not None:
            exam['answers'][qid] = ans
    # optionally auto‑finish when all answered
    if len(exam['answers']) == len(exam['questions']):
        exam['finished'] = True
        # cancel timer
        timer = exam.get('timer')
        if timer:
            timer.cancel()
    return jsonify({'success': True, 'answered': len(exam['answers'])})

def _grade_exam(exam: Dict) -> Dict:
    # simple grading: compare stored answer field; for code/short we just mark as unknown (0).
    score = 0
    total = len(exam['questions'])
    weak_topics: List[str] = []
    for q in exam['questions']:
        qid = q['id']
        correct = q.get('answer')
        user_ans = exam['answers'].get(qid)
        if correct is not None and str(user_ans).strip().lower() == str(correct).strip().lower():
            score += 1
        else:
            weak_topics.append(q['prompt'][:80])
    return {
        'score': score,
        'total': total,
        'percentage': round(100 * score / total, 2),
        'weak_topics': weak_topics
    }

@app.route('/exam/result/<exam_id>', methods=['GET'])
def exam_result(exam_id):
    exam = _exam_store.get(exam_id)
    if not exam:
        return jsonify({'success': False, 'error': 'exam not found'}), 404
    if not exam['finished'] and not exam.get('expired'):
        return jsonify({'success': False, 'error': 'exam not completed yet'}), 400
    grading = _grade_exam(exam)
    # Build weakness report – simple textual summary
    report = "\nWeakness Report:\n" + "\n".join(f"- {t}" for t in grading['weak_topics'][:10])
    return jsonify({
        'success': True,
        'exam_id': exam_id,
        'score': grading['score'],
        'total': grading['total'],
        'percentage': grading['percentage'],
        'weakness_report': report
    })

if __name__ == '__main__':
    print('[EXAM] University Exam Simulator listening on 3044')
    app.run(host='127.0.0.1', port=3044, debug=False, use_reloader=False)
