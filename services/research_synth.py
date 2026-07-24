'''Research Synthesis Engine – given a research topic, pull the top‑N recent arXiv papers, summarize each via the local AirLLM service, then synthesize a concise 1‑page report highlighting agreements, contradictions, and open questions.
Features:
  • POST /synthesize – body {"topic": "...", "num_papers": 5}
  • Returns JSON with paper list (title, url, summary) and a synthesis string.
  • Uses the existing AirLLM service (localhost:3006) for summarisation and synthesis.
  • Optional EventBus broadcast "research_update" for UI notifications.
'''

import os, json, time, threading
from pathlib import Path
from typing import List, Dict, Any

import requests

# Optional EventBus for UI feedback
try:
    from backend.event_bus import EventBus
    _bus = EventBus.get_instance()
except Exception:
    _bus = None

# ---------------------------------------------------------------------------
# Helper – fetch recent arXiv papers (requires ``arxiv`` package)
# ---------------------------------------------------------------------------
def _search_arxiv(topic: str, max_results: int = 5) -> List[Dict[str, str]]:
    try:
        import arxiv
    except ImportError:
        print('[RESEARCH] ⚠ arxiv package missing – install via pip install arxiv')
        return []
    query = f"all:{topic}"
    search = arxiv.Search(query=query,
                           max_results=max_results,
                           sort_by=arxiv.SortCriterion.SubmittedDate,
                           sort_order=arxiv.SortOrder.Descending)
    papers = []
    for result in search.results():
        papers.append({
            'title': result.title.strip(),
            'url': result.pdf_url,
            'abstract': result.summary.strip()
        })
    return papers

# ---------------------------------------------------------------------------
# Helper – ask AirLLM to summarise a piece of text
# ---------------------------------------------------------------------------
def _llm_summarize(text: str, model: str = 'deep-think-70b') -> str:
    # Prompt engineered for concise 2‑sentence summary of a scientific abstract
    prompt = f"Summarise the following research abstract in two sentences, focusing on the core contribution and key result.\n\nAbstract:\n{text}\n\nSummary:"
    try:
        resp = requests.post('http://127.0.0.1:3006/deep/think',
                             json={'prompt': prompt, 'model': model, 'max_tokens': 256},
                             timeout=30)
        data = resp.json()
        content = data.get('content')
        if isinstance(content, str):
            return content.strip()
        # If the LLM wrapped the answer in a dict
        return str(content)
    except Exception as e:
        print(f'[RESEARCH] LLM summarise error: {e}')
        return ''

# ---------------------------------------------------------------------------
# Core synthesis – combine paper summaries into a structured report
# ---------------------------------------------------------------------------
def _llm_synthesize(topic: str, paper_summaries: List[Dict[str, str]], model: str = 'deep-think-70b') -> str:
    # Build a prompt that asks for agreements, contradictions, and open questions
    summary_block = "\n\n---\n\n".join([f"Paper {i+1}: {p['title']}\nSummary: {p['summary']}" for i, p in enumerate(paper_summaries)])
    prompt = f"You are a research analyst. Given the following summaries of recent papers about '{topic}', produce a concise 1‑page synthesis that includes:\n1. Points of agreement among the papers.\n2. Any contradictions or differing conclusions.\n3. Open research questions that remain unanswered.\n\nSummaries:\n{summary_block}\n\nSynthesis:"
    try:
        resp = requests.post('http://127.0.0.1:3006/deep/think',
                             json={'prompt': prompt, 'model': model, 'max_tokens': 1024},
                             timeout=45)
        data = resp.json()
        content = data.get('content')
        if isinstance(content, str):
            return content.strip()
        return str(content)
    except Exception as e:
        print(f'[RESEARCH] LLM synthesis error: {e}')
        return ''

# ---------------------------------------------------------------------------
# Flask API exposing the service
# ---------------------------------------------------------------------------
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/synthesize', methods=['POST'])
def synthesize_endpoint():
    payload = request.get_json() or {}
    topic = payload.get('topic')
    num = int(payload.get('num_papers', 5))
    if not topic:
        return jsonify({'success': False, 'error': 'topic required'}), 400
    # 1️⃣ Fetch arXiv papers
    papers = _search_arxiv(topic, max_results=num)
    if not papers:
        return jsonify({'success': False, 'error': 'no papers found or arxiv missing'}), 500
    # 2️⃣ Summarise each paper via LLM
    for p in papers:
        p['summary'] = _llm_summarize(p['abstract'])
    # 3️⃣ Synthesize overall report
    synthesis = _llm_synthesize(topic, papers)
    # 4️⃣ Broadcast optional UI event
    if _bus:
        import asyncio
        async def _pub():
            await _bus.publish('research_update', {'topic': topic, 'paper_count': len(papers)})
        asyncio.run(_pub())
    # 5️⃣ Return JSON response
    return jsonify({
        'success': True,
        'topic': topic,
        'papers': [{
            'title': p['title'],
            'url': p['url'],
            'summary': p['summary']
        } for p in papers],
        'synthesis': synthesis
    })

if __name__ == '__main__':
    print('[RESEARCH] Research Synthesis Engine listening on 3055')
    app.run(host='127.0.0.1', port=3055, debug=False, use_reloader=False)
