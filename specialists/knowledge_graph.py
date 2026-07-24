'''Neural Knowledge Graph – builds a dynamic concept graph of studied topics.
Each topic is a node; edges represent semantic similarity (computed via simple cosine similarity on embeddings).
The graph is stored in-memory (NetworkX) and can be persisted to a JSON file.
Endpoints:
  POST /graph/add   – add a new topic (optionally with a list of related topics).
  GET  /graph/get   – return the full graph as JSON (nodes with ids & labels, edges).
  GET  /graph/search?q=... – find nearest nodes.
The service publishes ``graph_update`` events via the EventBus for UI components to react.
'''

import os
import json
import time
import threading
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

# Optional: use existing EventBus for realtime UI updates
try:
    from backend.event_bus import EventBus
    _event_bus = EventBus.get_instance()
except Exception:
    _event_bus = None  # fallback – no broadcasting

# ---------------------------------------------------------------------------
# Graph storage – NetworkX (lightweight)
# ---------------------------------------------------------------------------
try:
    import networkx as nx
    _NX_OK = True
except ImportError:
    _NX_OK = False
    print('[GRAPH] ⚠ networkx missing – install via pip install networkx')

# Persistence file (in workspace)
GRAPH_FILE = Path(__file__).parent / 'knowledge_graph.json'

def _load_graph() -> 'nx.Graph':
    if not _NX_OK:
        raise RuntimeError('networkx not available')
    g = nx.Graph()
    if GRAPH_FILE.exists():
        try:
            data = json.loads(GRAPH_FILE.read_text(encoding='utf-8'))
            g.add_nodes_from(data.get('nodes', []))
            g.add_edges_from(data.get('edges', []))
        except Exception as e:
            print(f'[GRAPH] Failed to load persisted graph: {e}')
    return g

def _save_graph(g: 'nx.Graph') -> None:
    if not _NX_OK:
        return
    data = {
        'nodes': list(g.nodes(data=True)),
        'edges': list(g.edges(data=True)),
    }
    GRAPH_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')

# Global graph instance
_graph_lock = threading.Lock()
_graph = _load_graph() if _NX_OK else None

# ---------------------------------------------------------------------------
# Helper – simple embedding stub (real implementation would call an LLM)
# ---------------------------------------------------------------------------
def _embed_text(text: str) -> list:
    # Very naive deterministic embedding: hash → vector of 10 floats
    import hashlib, struct
    h = hashlib.sha256(text.encode('utf-8')).digest()
    # unpack first 10 floats (4 bytes each) – pad if needed
    fmt = '<' + 'f'*10
    # ensure enough bytes
    padded = h.ljust(40, b'0')
    return list(struct.unpack(fmt, padded[:40]))

def _cosine_similarity(a, b) -> float:
    import math
    dot = sum(x*y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x*x for x in a))
    norm_b = math.sqrt(sum(y*y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

# ---------------------------------------------------------------------------
# Core API functions
# ---------------------------------------------------------------------------
def add_topic(topic: str, related: list | None = None) -> dict:
    """Add *topic* as a node. If *related* list is supplied, create edges.
    When *related* is omitted, we compute similarity to all existing nodes and
    connect to the top‑3 most similar ones (threshold 0.6).
    """
    if not _NX_OK:
        return {'success': False, 'error': 'networkx not installed'}
    if not topic:
        return {'success': False, 'error': 'topic missing'}
    with _graph_lock:
        if topic in _graph:
            return {'success': True, 'message': 'topic already exists'}
        # Add node with embedding for later similarity checks
        embedding = _embed_text(topic)
        _graph.add_node(topic, embedding=embedding)
        # Determine edges
        if related:
            for rel in related:
                if rel in _graph:
                    _graph.add_edge(topic, rel)
        else:
            # Auto‑connect to most similar existing nodes
            similarities = []
            for existing in _graph.nodes:
                if existing == topic:
                    continue
                existing_emb = _graph.nodes[existing].get('embedding')
                if existing_emb is None:
                    continue
                sim = _cosine_similarity(embedding, existing_emb)
                similarities.append((sim, existing))
            # Sort descending and connect to top‑3 above threshold
            for sim, node in sorted(similarities, reverse=True)[:3]:
                if sim >= 0.6:
                    _graph.add_edge(topic, node, weight=sim)
        _save_graph(_graph)
        # Broadcast update via EventBus if available
        if _event_bus:
            # fire‑and‑forget async publish – wrap in tiny coroutine
            import asyncio
            async def _pub():
                await _event_bus.publish('graph_update', {'topic': topic})
            asyncio.run(_pub())
        return {'success': True, 'message': f'added {topic}'}

def get_graph_json() -> dict:
    if not _NX_OK:
        return {'success': False, 'error': 'networkx not installed'}
    with _graph_lock:
        nodes = [{'id': n, 'label': n} for n in _graph.nodes]
        edges = [{'source': u, 'target': v, 'weight': _graph[u][v].get('weight', 1.0)} for u, v in _graph.edges]
    return {'success': True, 'nodes': nodes, 'edges': edges}

def search_nearest(query: str, top_k: int = 5) -> dict:
    if not _NX_OK:
        return {'success': False, 'error': 'networkx not installed'}
    q_emb = _embed_text(query)
    with _graph_lock:
        sims = []
        for node in _graph.nodes:
            emb = _graph.nodes[node].get('embedding')
            if emb is None:
                continue
            sims.append((_cosine_similarity(q_emb, emb), node))
        results = [node for _, node in sorted(sims, reverse=True)[:top_k]]
    return {'success': True, 'matches': results}

# ---------------------------------------------------------------------------
# Flask app – lightweight server exposing the above helpers
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

@app.route('/graph/add', methods=['POST'])
def api_add():
    data = request.get_json() or {}
    topic = data.get('topic')
    related = data.get('related')  # optional list
    res = add_topic(topic, related)
    return jsonify(res)

@app.route('/graph/get', methods=['GET'])
def api_get():
    return jsonify(get_graph_json())

@app.route('/graph/search', methods=['GET'])
def api_search():
    q = request.args.get('q', '')
    k = int(request.args.get('k', '5'))
    return jsonify(search_nearest(q, top_k=k))

if __name__ == '__main__':
    # Auto‑load persisted graph on start
    if _NX_OK:
        print('[GRAPH] Loaded graph with', _graph.number_of_nodes(), 'nodes')
    app.run(host='127.0.0.1', port=3033, debug=False, use_reloader=False)
