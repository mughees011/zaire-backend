"""
ZAIRE Vector Memory Service — Tier 1 Brain Upgrade
Replaces flat JSON lookups with ChromaDB semantic search.
Runs as a Flask sidecar on port 3004 — called by Node.js backend.

Install deps:
    pip install chromadb flask flask-cors sentence-transformers
"""

import os
import sys
import json
import uuid
import time
from datetime import datetime

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import chromadb
    from chromadb.config import Settings
except ImportError as e:
    print(f"[VECTOR_MEMORY] Missing: {e}")
    print("Run: pip install chromadb flask flask-cors")
    sys.exit(1)

# ─── Bootstrap ───────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

PERSIST_DIR = os.path.join(os.path.dirname(__file__), "memory", "vector_db")
os.makedirs(PERSIST_DIR, exist_ok=True)

# ChromaDB client (persisted to disk)
chroma_client = chromadb.PersistentClient(path=PERSIST_DIR)

# Two collections: general facts + study progress
facts_col = chroma_client.get_or_create_collection(
    name="zaire_facts",
    metadata={"hnsw:space": "cosine"}
)
study_col = chroma_client.get_or_create_collection(
    name="zaire_study",
    metadata={"hnsw:space": "cosine"}
)
# SONA Trajectory Memory: Stores (Goal -> Plan -> Outcome)
trajectories_col = chroma_client.get_or_create_collection(
    name="zaire_trajectories",
    metadata={"hnsw:space": "cosine"}
)
# Semantic Cache: Stores (Query -> Best LLM Response)
cache_col = chroma_client.get_or_create_collection(
    name="zaire_cache",
    metadata={"hnsw:space": "cosine"}
)

print(f"[VECTOR_MEMORY] Collections loaded. Facts: {facts_col.count()}, Study: {study_col.count()}, Trajectories: {trajectories_col.count()}")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _meta(extra: dict = None) -> dict:
    """Build standard metadata payload."""
    base = {"timestamp": datetime.now().isoformat(), "epoch": int(time.time())}
    if extra:
        base.update(extra)
    return base


# ─── Routes: Facts ───────────────────────────────────────────────────────────

@app.route("/memory/remember", methods=["POST"])
@app.route("/memory/store", methods=["POST"])
def store_fact():
    """
    Store a fact in long-term semantic memory.
    Body: { "text": "...", "tag": "optional_category" }
    """
    data = request.get_json()
    text = (data.get("text") or "").strip()
    tag  = data.get("tag", "general")

    if len(text) < 3:
        return jsonify({"success": False, "error": "Text too short."}), 400

    doc_id = str(uuid.uuid4())
    facts_col.add(
        documents=[text],
        metadatas=[_meta({"tag": tag})],
        ids=[doc_id]
    )

    print(f"[VECTOR_MEMORY] Stored fact [{doc_id[:8]}]: {text[:60]}...")
    return jsonify({"success": True, "id": doc_id, "total": facts_col.count()})


@app.route("/memory/recall", methods=["POST"])
def recall_facts():
    """
    Semantically recall facts relevant to a query.
    Body: { "query": "...", "n": 5, "tag": "optional_filter" }
    """
    data   = request.get_json()
    query  = (data.get("query") or "").strip()
    n      = min(int(data.get("n", 5)), 20)
    tag    = data.get("tag")  # optional category filter

    if not query:
        # No query — return most recent N
        results = facts_col.get(limit=n, include=["documents", "metadatas"])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])
        items = [{"text": d, "score": 1.0, "meta": m} for d, m in zip(docs, metas)]
        return jsonify({"success": True, "results": items})

    where = {"tag": tag} if tag else None

    try:
        results = facts_col.query(
            query_texts=[query],
            n_results=min(n, facts_col.count()) if facts_col.count() > 0 else 1,
            where=where,
            include=["documents", "metadatas", "distances"]
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    docs      = results["documents"][0]
    metas     = results["metadatas"][0]
    distances = results["distances"][0]

    # Convert cosine distance → similarity score (0 to 1)
    items = [
        {
            "text": doc,
            "score": round(1 - dist, 4),
            "meta": meta
        }
        for doc, dist, meta in zip(docs, distances, metas)
        if (1 - dist) > 0.20   # Relevance threshold: 20% minimum similarity
    ]

    print(f"[VECTOR_MEMORY] Recalled {len(items)} facts for query: '{query[:40]}'")
    return jsonify({"success": True, "results": items})


@app.route("/memory/forget", methods=["POST"])
def forget_fact():
    """Delete a specific fact by ID."""
    data = request.get_json()
    doc_id = data.get("id")
    if not doc_id:
        return jsonify({"success": False, "error": "No ID provided."}), 400
    try:
        facts_col.delete(ids=[doc_id])
        return jsonify({"success": True, "remaining": facts_col.count()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/memory/all", methods=["GET"])
def all_facts():
    """Return all stored facts (max 100)."""
    results = facts_col.get(limit=100, include=["documents", "metadatas", "ids"])
    items = [
        {"id": i, "text": d, "meta": m}
        for i, d, m in zip(
            results.get("ids", []),
            results.get("documents", []),
            results.get("metadatas", [])
        )
    ]
    return jsonify({"success": True, "facts": items, "total": facts_col.count()})


@app.route("/memory/count", methods=["GET"])
def count():
    return jsonify({
        "facts": facts_col.count(),
        "study": study_col.count()
    })


# ─── Routes: Study Memory ────────────────────────────────────────────────────

@app.route("/memory/study/store", methods=["POST"])
def store_study():
    """
    Store a study event (topic studied, level, notes).
    Body: { "topic": "...", "level": "...", "notes": "..." }
    """
    data  = request.get_json()
    topic = data.get("topic", "Unknown")
    level = data.get("level", "unknown")
    notes = data.get("notes", "")

    text = f"Studied: {topic}. Level: {level}. Notes: {notes}"
    doc_id = str(uuid.uuid4())

    study_col.add(
        documents=[text],
        metadatas=[_meta({"topic": topic, "level": level})],
        ids=[doc_id]
    )

    print(f"[VECTOR_MEMORY] Study event stored: {topic}")
    return jsonify({"success": True, "id": doc_id})


@app.route("/memory/study/recall", methods=["POST"])
def recall_study():
    """Return semantically relevant past study sessions."""
    data  = request.get_json()
    query = (data.get("query") or "").strip()
    n     = min(int(data.get("n", 5)), 20)

    if study_col.count() == 0:
        return jsonify({"success": True, "results": []})

    if not query:
        results = study_col.get(limit=n, include=["documents", "metadatas"])
        items = [{"text": d, "meta": m} for d, m in zip(
            results.get("documents", []), results.get("metadatas", [])
        )]
        return jsonify({"success": True, "results": items})

    results = study_col.query(
        query_texts=[query],
        n_results=min(n, study_col.count()),
        include=["documents", "metadatas", "distances"]
    )

    items = [
        {"text": doc, "score": round(1 - dist, 4), "meta": meta}
        for doc, dist, meta in zip(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0]
        )
        if (1 - dist) > 0.15
    ]

    return jsonify({"success": True, "results": items})

# ─── Routes: SONA Trajectory Memory ──────────────────────────────────────────

@app.route("/memory/trajectory/store", methods=["POST"])
def store_trajectory():
    """
    Store a successful (or failed) task trajectory for future learning.
    Body: { "goal": "...", "plan": [...], "outcome": "...", "score": 0.0 to 1.0 }
    """
    data    = request.get_json()
    goal    = data.get("goal", "")
    plan    = data.get("plan", [])
    outcome = data.get("outcome", "")
    score   = data.get("score", 1.0)

    if not goal:
        return jsonify({"success": False, "error": "Goal required."}), 400

    # Store the goal string as the document for semantic retrieval
    # Store the plan and outcome in metadata
    doc_id = str(uuid.uuid4())
    trajectories_col.add(
        documents=[goal],
        metadatas=[_meta({
            "plan": json.dumps(plan),
            "outcome": outcome,
            "score": score
        })],
        ids=[doc_id]
    )

    print(f"[VECTOR_MEMORY] Trajectory stored for goal: {goal[:50]}... (Score: {score})")
    return jsonify({"success": True, "id": doc_id})


@app.route("/memory/trajectory/recall", methods=["POST"])
def recall_trajectory():
    """Find similar past goals to retrieve the plan/outcome."""
    data  = request.get_json()
    query = (data.get("query") or "").strip()
    n     = min(int(data.get("n", 3)), 10)

    if trajectories_col.count() == 0:
        return jsonify({"success": True, "results": []})

    results = trajectories_col.query(
        query_texts=[query],
        n_results=min(n, trajectories_col.count()),
        include=["documents", "metadatas", "distances"]
    )

    items = [
        {
            "goal": doc,
            "score": round(1 - dist, 4),
            "plan": json.loads(meta.get("plan", "[]")),
            "outcome": meta.get("outcome", ""),
            "quality_score": meta.get("score", 0)
        }
        for doc, dist, meta in zip(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0]
        )
        if (1 - dist) > 0.40 # Higher threshold for trajectory reuse
    ]

    return jsonify({"success": True, "results": items})

# ─── Routes: Semantic Response Cache ──────────────────────────────────────────

@app.route("/memory/cache/store", methods=["POST"])
def store_cache():
    """
    Store a query-response pair in the semantic cache.
    Body: { "query": "...", "response": "..." }
    """
    data     = request.get_json()
    query    = (data.get("query") or "").strip()
    response = (data.get("response") or "").strip()

    if not query or not response:
        return jsonify({"success": False, "error": "Query and Response required."}), 400

    doc_id = str(uuid.uuid4())
    cache_col.add(
        documents=[query],
        metadatas=[_meta({"response": response})],
        ids=[doc_id]
    )

    print(f"[VECTOR_MEMORY] Cached response for query: {query[:50]}...")
    return jsonify({"success": True, "id": doc_id})


@app.route("/memory/cache/recall", methods=["POST"])
def recall_cache():
    """Find a highly similar past response to save quota."""
    data  = request.get_json()
    query = (data.get("query") or "").strip()
    threshold = float(data.get("threshold", 0.95)) # High default for exact-ish matches

    if cache_col.count() == 0:
        return jsonify({"success": True, "hit": False})

    results = cache_col.query(
        query_texts=[query],
        n_results=1,
        include=["documents", "metadatas", "distances"]
    )

    if not results["documents"][0]:
        return jsonify({"success": True, "hit": False})

    doc      = results["documents"][0][0]
    dist     = results["distances"][0][0]
    meta     = results["metadatas"][0][0]
    score    = 1 - dist

    if score >= threshold:
        print(f"[VECTOR_MEMORY] Cache HIT (Score: {score:.4f}) for query: {query[:40]}")
        return jsonify({
            "success": True,
            "hit": True,
            "score": score,
            "response": meta.get("response", "")
        })

    return jsonify({"success": True, "hit": False, "best_score": score})


# ─── Context Builder (used by Node.js to inject into system prompt) ──────────

@app.route("/memory/context", methods=["POST"])
def build_context():
    """
    One-shot endpoint: given a user query, return a formatted context
    block that can be injected directly into the LLM system prompt.
    Body: { "query": "...", "include_study": true }
    """
    data          = request.get_json()
    query         = (data.get("query") or "").strip()
    include_study = data.get("include_study", True)

    context_parts = []

    # 1. Recall relevant facts
    if facts_col.count() > 0:
        try:
            fact_results = facts_col.query(
                query_texts=[query] if query else [""],
                n_results=min(5, facts_col.count()),
                include=["documents", "distances"]
            )
            facts = [
                doc for doc, dist in zip(
                    fact_results["documents"][0],
                    fact_results["distances"][0]
                )
                if (1 - dist) > 0.15
            ]
            if facts:
                bullet = "\n".join(f"  • {f}" for f in facts)
                context_parts.append(
                    f"[HIVE-MIND CROSS-MODE MEMORY — Recent context from ALL ZAIRE Specialists (Trader, Professor, Engineer) relevant to the current query. Unify your knowledge across domains:]\n{bullet}"
                )
        except Exception as e:
            print(f"[VECTOR_MEMORY] Context fact recall error: {e}")

    # 2. Recall relevant study sessions
    if include_study and study_col.count() > 0:
        try:
            study_results = study_col.query(
                query_texts=[query] if query else [""],
                n_results=min(5, study_col.count()),
                include=["documents", "metadatas", "distances"]
            )
            sessions = [
                meta.get("topic", doc)
                for doc, dist, meta in zip(
                    study_results["documents"][0],
                    study_results["distances"][0],
                    study_results["metadatas"][0]
                )
                if (1 - dist) > 0.10
            ]
            if sessions:
                bullet = "\n".join(f"  • {s}" for s in sessions)
                context_parts.append(
                    f"[HIVE-MIND STUDY MEMORY — Cross-disciplinary topics Mughees has studied recently:]\n{bullet}"
                )
        except Exception as e:
            print(f"[VECTOR_MEMORY] Context study recall error: {e}")

    context = "\n\n".join(context_parts)
    return jsonify({"success": True, "context": context})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "zaire-vector-memory",
        "facts": facts_col.count(),
        "study": study_col.count(),
        "trajectories": trajectories_col.count(),
        "cache": cache_col.count()
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    print("\n==============================================")
    print("  ZAIRE Vector Memory Service (ChromaDB)")
    print("  Flask server on port 3004")
    print("==============================================\n")
    app.run(host="127.0.0.1", port=3004, debug=False, use_reloader=False)
