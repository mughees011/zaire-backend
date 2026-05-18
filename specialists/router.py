"""
ZAIRE Specialist Router — Tier 1 Upgraded
Supports:
  - Direct specialist routing (PROFESSOR, TRADER, ENGINEER, ARTIFACT)
  - SWARM mode: multi-specialist parallel analysis + master synthesis
  - FUSION mode: context-aware auto-routing across specialists
  - Vector memory injection into all specialist prompts
  - Local LLM fallback if Groq is unavailable
"""

import os
import time
import re
import json
import requests
from specialists.trader    import TraderSpecialist
from specialists.professor import ProfessorSpecialist
from specialists.engineer  import EngineerSpecialist
from specialists.business  import BusinessSpecialist
from specialists.multimodal import ZaireVision
from .llm_utils import call_llm_sync, call_llm_stream, SafeGroqClient
from goap_planner import GOAPPlanner

# ─── Service URLs ─────────────────────────────────────────────────────────────
VECTOR_MEMORY_URL = "http://127.0.0.1:3004"
LOCAL_LLM_URL     = "http://127.0.0.1:3005"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_vector_context(query: str) -> str:
    """Fetch semantically relevant memory context for a query."""
    try:
        r = requests.post(
            f"{VECTOR_MEMORY_URL}/memory/context",
            json={"query": query, "include_study": True},
            timeout=3
        )
        if r.status_code == 200:
            return r.json().get("context", "")
    except Exception as e:
        print(f"[ROUTER] Vector memory unavailable: {e}")
    return ""

def _store_vector_memory(text: str, tag: str = "general"):
    """Async-style store to vector memory (fire and forget)."""
    try:
        requests.post(
            f"{VECTOR_MEMORY_URL}/memory/store",
            json={"text": text, "tag": tag},
            timeout=2
        )
    except Exception:
        pass  # Non-critical

def _get_trajectory_context(query: str) -> list:
    """Recall similar past goal trajectories."""
    try:
        r = requests.post(
            f"{VECTOR_MEMORY_URL}/memory/trajectory/recall",
            json={"query": query, "n": 2},
            timeout=3
        )
        if r.status_code == 200:
            return r.json().get("results", [])
    except Exception as e:
        print(f"[ROUTER] Trajectory memory unavailable: {e}")
    return []

def _store_trajectory(goal: str, plan: list, outcome: str, score: float = 1.0):
    """Store a successful execution path."""
    try:
        requests.post(
            f"{VECTOR_MEMORY_URL}/memory/trajectory/store",
            json={"goal": goal, "plan": plan, "outcome": outcome, "score": score},
            timeout=2
        )
    except Exception:
        pass

def _local_llm_available() -> bool:
    """Check if local Ollama fallback is running."""
    try:
        r = requests.get(f"{LOCAL_LLM_URL}/llm/health", timeout=2)
        return r.status_code == 200 and r.json().get("ollama") is True
    except Exception:
        return False

# ─── Router Class ─────────────────────────────────────────────────────────────

class SpecialistRouter:
    def __init__(self, unused_api_key=None):
        self.groq_client = SafeGroqClient(api_key=os.environ.get("GROQ_API_KEY"))
        
        self.specialists = {
            "TRADER":    TraderSpecialist(self.groq_client),
            "PROFESSOR": ProfessorSpecialist(self.groq_client),
            "ENGINEER":  EngineerSpecialist(self.groq_client),
            "BUSINESS":  BusinessSpecialist(self.groq_client),
            "ARTIFACT":  ZaireVision()
        }
        self.planner = GOAPPlanner()
        self.active_mode = "ZAIRE"
        self.model = "llama-3.3-70b-versatile"

    def set_mode(self, mode):
        self.active_mode = mode
        if mode in self.specialists:
            self.specialists[mode].reset_history()

    def _call_with_fallback(self, messages: list, model: str = None) -> str:
        """Centralized failover routing using shared utility."""
        return call_llm_sync(messages, model or self.model)

    # ── Main Entry Point ──────────────────────────────────────────────────────

    def process(self, user_message, mode, manifest=None,
                uploaded_filepath=None, uploaded_filepaths=None):
        """Returns a generator that yields text chunks."""

        # ── SWARM / FUSION trigger ────────────────────────────────────────────
        swarm_triggers = ["consult the council", "swarm mode", "all specialists"]
        fusion_triggers = ["combine", "cross-check", "both views", "multiple angles",
                           "professor and trader", "trader and engineer",
                           "engineer and professor", "everyone's opinion"]

        msg_lower = user_message.lower()

        if mode == "SWARM" or any(t in msg_lower for t in swarm_triggers):
            return self.swarm_handle(
                user_message,
                uploaded_filepath=uploaded_filepath,
                uploaded_filepaths=uploaded_filepaths
            )

        if any(t in msg_lower for t in fusion_triggers):
            return self.fusion_handle(
                user_message,
                uploaded_filepath=uploaded_filepath,
                uploaded_filepaths=uploaded_filepaths
            )

        # ── GOAP / SONA trigger ───────────────────────────────────────────────
        goap_triggers = ["goal", "plan", "execute task", "multi-step", "achieve"]
        if any(t in msg_lower for t in goap_triggers):
            return self.goap_handle(
                user_message,
                uploaded_filepath=uploaded_filepath,
                uploaded_filepaths=uploaded_filepaths
            )

        # ── Direct specialist routing ─────────────────────────────────────────
        if mode in self.specialists:
            # Inject vector memory context into the message
            vector_ctx = _get_vector_context(user_message)
            
            # Apply Emotional Intelligence
            try:
                from emotional_intelligence import EmotionalIntelligenceLayer
                ei_layer = EmotionalIntelligenceLayer()
                # For now, we simulate detecting the emotion. You can pass the wav path if available.
                emotion = ei_layer.analyze_audio("user_input.wav")
                emotion_modifier = ei_layer.get_prompt_modifier(emotion)
            except Exception:
                emotion_modifier = ""
                
            enriched_message = user_message
            if vector_ctx or emotion_modifier:
                enriched_message = f"{emotion_modifier}\n\n{vector_ctx}\n\n[USER REQUEST]\n{user_message}"

            if mode == "ARTIFACT":
                stream = self.specialists[mode].handle(enriched_message, manifest)
            else:
                stream = self.specialists[mode].handle(
                    enriched_message,
                    uploaded_filepath=uploaded_filepath,
                    uploaded_filepaths=uploaded_filepaths
                )

            full_response = ""
            for chunk in stream:
                if chunk:
                    # Robustly handle nested generators if they slip through
                    if hasattr(chunk, '__iter__') and not isinstance(chunk, (str, bytes)):
                        for sub_chunk in chunk:
                            if sub_chunk:
                                full_response += sub_chunk
                                yield sub_chunk
                    else:
                        full_response += chunk
                        yield chunk

            # Store the interaction in vector memory
            if full_response and len(full_response) > 50:
                _store_vector_memory(
                    f"[{mode}] Q: {user_message[:200]} | A: {full_response[:300]}",
                    tag=mode.lower()
                )
        else:
            return None

    # ── FUSION: Smart 2-Specialist Cross-Analysis ─────────────────────────────

    def fusion_handle(self, user_message, uploaded_filepath=None, uploaded_filepaths=None):
        yield "🧠 **Engaging Neural Fusion Protocol...** Synthesizing multi-specialist perspectives.\n\n"
        
        # Decide which specialists to fusion
        target_specialists = []
        if "trader" in user_message.lower(): target_specialists.append("TRADER")
        if "professor" in user_message.lower(): target_specialists.append("PROFESSOR")
        if "engineer" in user_message.lower() or "code" in user_message.lower(): target_specialists.append("ENGINEER")
        
        if len(target_specialists) < 2:
            # Auto-selection based on content if not explicit
            if "market" in user_message.lower() or "price" in user_message.lower():
                target_specialists = ["TRADER", "PROFESSOR"]
            else:
                target_specialists = ["PROFESSOR", "ENGINEER"]

        analyses = {}
        for s_name in target_specialists:
            yield f"📡 **Querying {s_name} Module...**\n"
            # We use non-streaming here for simpler fusion
            resp = ""
            stream = self.specialists[s_name].handle(user_message, uploaded_filepath, uploaded_filepaths)
            for chunk in stream:
                if isinstance(chunk, str): resp += chunk
            analyses[s_name] = resp

        # Final Synthesis
        synthesis_prompt = f"""
        User Message: {user_message}
        
        Analyses from specialists:
        {json.dumps(analyses, indent=2)}
        
        Synthesize a final high-level response that combines these views with Stark-grade intelligence.
        """
        
        for chunk in call_llm_stream([{"role": "user", "content": synthesis_prompt}], self.model):
            yield chunk

    # ── SWARM: Global Multi-Agent Protocol ────────────────────────────────────

    def swarm_handle(self, user_message, uploaded_filepath=None, uploaded_filepaths=None):
        yield "🌀 **Initializing NEURAL SWARM Protocol...** All specialists standing by.\n\n"
        
        # 1. Director Phase: Analyze intent
        director_prompt = f"""
        Analyze this request: "{user_message}"
        Identify which specialists are needed (TRADER, PROFESSOR, ENGINEER).
        Return as a JSON list of keys.
        """
        director_resp = self._call_with_fallback([{"role": "user", "content": director_prompt}], model="llama-3.1-8b-instant")
        
        try:
            needed = json.loads(re.search(r'\[.*\]', director_resp).group())
        except:
            needed = ["PROFESSOR", "ENGINEER"] # Default

        analyses = {}
        for s_name in needed:
            if s_name in self.specialists:
                yield f"⚡ **{s_name} Specialist Analysis in progress...**\n"
                resp = ""
                stream = self.specialists[s_name].handle(user_message, uploaded_filepath, uploaded_filepaths)
                for chunk in stream:
                    if isinstance(chunk, str): resp += chunk
                analyses[s_name] = resp

        # Final Synthesis
        yield "🛡️ **Specialist perspectives gathered. Manifesting final synthesis...**\n\n"
        synthesis_prompt = f"""
        User Request: {user_message}
        Specialist Inputs: {json.dumps(analyses)}
        Provide a final unified command response.
        """
        for chunk in call_llm_stream([{"role": "user", "content": synthesis_prompt}], self.model):
            yield chunk

    # ── GOAP: Goal-Oriented Action Protocol & SONA Learning ────────────────────

    def goap_handle(self, user_message, uploaded_filepath=None, uploaded_filepaths=None):
        yield "🎯 **Initializing SOVEREIGN GOAL Protocol...** Accessing SONA Trajectory Memory.\n\n"
        
        # 1. SONA Recall: Check if we've done something similar before
        past_trajectories = _get_trajectory_context(user_message)
        best_past = None
        if past_trajectories:
            best_past = past_trajectories[0]
            yield f"🧠 **SONA Memory Match Found!** (Similarity: {int(best_past['score']*100)}%)\n"
            yield f"   Re-evaluating past successful strategy for: *\"{best_past['goal'][:60]}...\"*\n\n"

        # 2. Planning Phase
        target_state = self.planner.translate_goal(user_message)
        plan = self.planner.plan({}, target_state)
        
        if not plan:
            yield "❌ **Goal Planning Failed.** Target state unreachable with current specialist capabilities.\n"
            return

        yield "📋 **Optimal Execution Path Determined:**\n"
        for i, action in enumerate(plan):
            yield f"  {i+1}. **[{action.specialist}]** {action.name}\n"
        yield "\n"

        # 3. Execution Phase
        results = {}
        execution_successful = True
        
        for action in plan:
            yield f"🚀 **Executing Step: {action.name}** via {action.specialist} Module...\n"
            
            # Prepare context for the specialist
            context = f"Current Goal: {user_message}\nPrevious Steps Progress: {json.dumps(results)}"
            
            resp = ""
            if action.specialist in self.specialists:
                stream = self.specialists[action.specialist].handle(
                    f"{context}\n\nTask: {action.name}",
                    uploaded_filepath=uploaded_filepath,
                    uploaded_filepaths=uploaded_filepaths
                )
                for chunk in stream:
                    if isinstance(chunk, str): resp += chunk
                
                results[action.name] = resp[:500] # Cap summary for next steps
            else:
                yield f"⚠️ Specialist {action.specialist} missing. Aborting trajectory.\n"
                execution_successful = False
                break

        # 4. Final Synthesis & Learning
        if execution_successful:
            yield "✅ **All actions completed successfully.** Synthesizing final objective result...\n\n"
            
            final_prompt = f"""
            Goal: {user_message}
            Actions Executed: {plan}
            Step-by-step Results: {json.dumps(results)}
            
            Provide a final unified result that achieves the original goal.
            """
            
            full_response = ""
            for chunk in call_llm_stream([{"role": "user", "content": final_prompt}], self.model):
                full_response += chunk
                yield chunk
                
            # SONA Learning: Store this trajectory for the future
            _store_trajectory(
                goal=user_message,
                plan=[a.name for a in plan],
                outcome=full_response[:1000],
                score=1.0
            )
            yield "\n\n✨ **Trajectory recorded in SONA Trajectory Memory for future auto-optimization.**"
        else:
            yield "🛑 **Execution Interrupted.** Check system logs for specialist availability."

    def get_mode_data(self, mode):
        if mode in self.specialists:
            if hasattr(self.specialists[mode], 'get_hud_data'):
                return self.specialists[mode].get_hud_data()
        return {}

    def handle_action(self, mode, action, payload):
        if mode == "SWARM" and action == "INITIATE_TASK":
            task = payload.get("task", "Global sync requested.")
            # Swarm is usually a streaming process, but for discrete action we return a confirmation
            return {"success": True, "message": f"Sovereign Master Protocol engaged for task: {task}"}
            
        if mode in self.specialists:
            if hasattr(self.specialists[mode], 'handle_action'):
                return self.specialists[mode].handle_action(action, payload)
        return {"error": "Specialist or action not supported"}
