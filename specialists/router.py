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


def _sanitize_mode_text(value, fallback=""):
    text = str(value or "").strip()
    return text or fallback


def _normalize_mode_list(values):
    if isinstance(values, list):
        return [str(item).strip() for item in values if str(item).strip()]
    return []


def _build_custom_mode_system_prompt(mode_config: dict) -> str:
    name = _sanitize_mode_text(mode_config.get("name"), "Custom Specialist")
    desc = _sanitize_mode_text(mode_config.get("desc"), "Deliver focused expert assistance.")
    persona = _sanitize_mode_text(mode_config.get("persona"), "A disciplined senior specialist.")
    goals = _sanitize_mode_text(mode_config.get("goals"), "Solve the user's request with expert-level depth.")
    never_do = _sanitize_mode_text(mode_config.get("neverDo"), "Do not fabricate facts, hidden access, or completed work.")
    preferred_output = _sanitize_mode_text(mode_config.get("preferredOutput"), "Action Plan")
    routing_priority = _sanitize_mode_text(mode_config.get("routingPriority"), "Balanced")
    capabilities = _normalize_mode_list(mode_config.get("capabilities"))
    permissions = mode_config.get("permissions") or {}
    expert_blueprint = mode_config.get("expertBlueprint") if isinstance(mode_config.get("expertBlueprint"), dict) else {}

    capability_notes = {
        "FILE SYSTEM": "You may analyze local project files and reason concretely from them when provided.",
        "WEB SEARCH": "If current or niche facts are required, explicitly say live verification is needed before claiming certainty.",
        "SCREEN VISION": "Interpret screenshots or visual state carefully when such context is supplied.",
        "CODE GENERATION": "Produce production-grade implementation guidance, not toy examples.",
        "VOICE INPUT": "Support spoken-command style interactions with concise confirmations.",
        "TASK AUTOMATION": "Break work into dependable steps with clear sequencing and checkpoints.",
        "DATA ANALYSIS": "Use structured reasoning, assumptions, and validation when analyzing data.",
        "MULTI-AGENT": "Behave like a coordinator that decomposes work into specialist lanes before synthesizing.",
    }

    routing_notes = {
        "Fast": "Move quickly, but never skip critical correctness checks.",
        "Balanced": "Balance speed, correctness, and clarity.",
        "Deep": "Prefer rigorous analysis, edge-case thinking, and careful validation before answering.",
    }

    permission_summary = [
        f"- File system access: {'allowed' if permissions.get('fileSystem') else 'not allowed'}",
        f"- Shell execution: {'allowed' if permissions.get('shellExecution') else 'not allowed'}",
        f"- Internet access: {'allowed' if permissions.get('internetAccess') else 'not allowed'}",
        f"- Screen capture: {'allowed' if permissions.get('screenCapture') else 'not allowed'}",
        f"- Hardware/media access: {'allowed' if permissions.get('hardwareMedia') else 'not allowed'}",
    ]

    expertise_lines = []
    for capability in capabilities:
        note = capability_notes.get(capability, f"Use {capability.lower()} only when it materially improves the answer.")
        expertise_lines.append(f"- {capability}: {note}")

    if not expertise_lines:
        expertise_lines.append("- General expertise: operate like a senior domain specialist with structured reasoning and strong judgment.")

    blueprint_lines = []
    for key in ("primaryMission",):
        value = _sanitize_mode_text(expert_blueprint.get(key))
        if value:
            blueprint_lines.append(f"- {value}")
    for key in ("expertiseChecklist", "operatingGuidelines", "refusalRules"):
        values = expert_blueprint.get(key)
        if isinstance(values, list):
            blueprint_lines.extend(f"- {str(item).strip()}" for item in values if str(item).strip())

    if not blueprint_lines:
        blueprint_lines.append("- Elevate the user's role definition into a concrete senior-level operating playbook before answering.")

    return f"""
You are ZAIRE custom specialist "{name}".

IDENTITY
- Role summary: {desc}
- Persona: {persona}
- Mission: {goals}

EXPERT STANDARD
- Act like an extraordinary expert in this mode, not a generic assistant.
- Before answering, silently derive the domain's best practices, key terminology, likely failure modes, and quality bar.
- If the request is underspecified, ask only the smallest number of clarifying questions needed to protect quality.
- Never pretend to have done research, opened tools, or verified facts when that did not happen.
- If a task needs live verification or missing data, say that plainly and continue with the best grounded guidance available.

SPECIALIST GUIDELINES
{chr(10).join(expertise_lines)}
- Expert blueprint:
{chr(10).join(blueprint_lines)}
- Routing priority: {routing_notes.get(routing_priority, routing_notes['Balanced'])}
- Preferred output shape: {preferred_output}
- When useful, structure your answer as diagnosis, plan, execution steps, risks, and next actions.
- State assumptions explicitly when they materially affect the answer.
- Use the user's provided role definition as the source of truth, then elevate it into professional-grade operating guidance.

BOUNDARIES
- Never do: {never_do}
- Respect these workspace permissions:
{chr(10).join(permission_summary)}

FINAL BEHAVIOR
- Be precise, confident, and helpful.
- Optimize for expert usefulness, not theatrics.
- Deliver answers that feel like they come from a top-tier specialist trusted in this exact domain.
""".strip()

# ─── Router Class ─────────────────────────────────────────────────────────────

class SpecialistRouter:
    def __init__(self, unused_api_key=None):
        self.groq_client = SafeGroqClient(api_key=None)
        
        self.specialists = {
            "TRADER":    TraderSpecialist(self.groq_client),
            "PROFESSOR": ProfessorSpecialist(self.groq_client),
            "ENGINEER":  EngineerSpecialist(self.groq_client),
            "BUSINESS":  BusinessSpecialist(self.groq_client),
            "ARTIFACT":  ZaireVision()
        }
        self.planner = GOAPPlanner()
        self.active_mode = "ZAIRE"
        self.active_custom_mode_config = None
        self.model = "Auto"
        self.swarm_state = {"phase": "IDLE", "messages": []}

    def _add_swarm_msg(self, source, text):
        import time
        msg = {
            "id": int(time.time()*1000) + len(self.swarm_state["messages"]),
            "source": source,
            "msg": text,
            "time": time.strftime("%H:%M:%S")
        }
        self.swarm_state["messages"].insert(0, msg)
        if len(self.swarm_state["messages"]) > 10:
            self.swarm_state["messages"].pop()

    def set_mode(self, mode, custom_mode_config=None):
        self.active_mode = mode
        self.active_custom_mode_config = custom_mode_config if isinstance(custom_mode_config, dict) else None
        if (
            mode not in self.specialists
            and self.active_custom_mode_config
            and _sanitize_mode_text(self.active_custom_mode_config.get("name")).upper() == _sanitize_mode_text(mode).upper()
        ):
            return self.custom_mode_handle(
                user_message,
                self.active_custom_mode_config,
                uploaded_filepath=uploaded_filepath,
                uploaded_filepaths=uploaded_filepaths
            )

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

    def custom_mode_handle(self, user_message, mode_config, uploaded_filepath=None, uploaded_filepaths=None):
        system_prompt = _build_custom_mode_system_prompt(mode_config)
        vector_ctx = _get_vector_context(user_message)

        context_chunks = []
        if vector_ctx:
            context_chunks.append(f"[MEMORY CONTEXT]\n{vector_ctx}")
        if uploaded_filepath:
            context_chunks.append(f"[PRIMARY FILE]\n{uploaded_filepath}")
        if uploaded_filepaths:
            file_list = "\n".join(f"- {path}" for path in uploaded_filepaths if path)
            if file_list:
                context_chunks.append(f"[ATTACHED FILES]\n{file_list}")

        user_payload = user_message
        if context_chunks:
            user_payload = f"{chr(10).join(context_chunks)}\n\n[USER REQUEST]\n{user_message}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ]

        full_response = ""
        for chunk in call_llm_stream(messages, self.model):
            if chunk:
                full_response += chunk
                yield chunk

        if full_response and len(full_response) > 50:
            mode_tag = _sanitize_mode_text(mode_config.get("name"), "custom").lower().replace(" ", "_")
            _store_vector_memory(
                f"[CUSTOM:{mode_tag}] Q: {user_message[:200]} | A: {full_response[:300]}",
                tag="custom_mode"
            )

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
        self.swarm_state["phase"] = "ANALYZING"
        self._add_swarm_msg("DIRECTOR", f"Received request: {user_message[:50]}...")
        yield "🌀 **Initializing NEURAL SWARM Protocol...** All specialists standing by.\n\n"
        
        # 1. Director Phase: Analyze intent
        director_prompt = f"""
        Analyze this request: "{user_message}"
        Identify which specialists are needed (TRADER, PROFESSOR, ENGINEER).
        Return as a JSON list of keys.
        """
        director_resp = self._call_with_fallback([{"role": "user", "content": director_prompt}], model="Auto")
        
        try:
            needed = json.loads(re.search(r'\[.*\]', director_resp).group())
        except:
            needed = ["PROFESSOR", "ENGINEER"] # Default

        self.swarm_state["phase"] = "DELEGATING"
        self._add_swarm_msg("DIRECTOR", f"Delegating to: {', '.join(needed)}")

        analyses = {}
        for s_name in needed:
            if s_name in self.specialists:
                self._add_swarm_msg(s_name, f"Analysis in progress...")
                yield f"⚡ **{s_name} Specialist Analysis in progress...**\n"
                resp = ""
                stream = self.specialists[s_name].handle(user_message, uploaded_filepath, uploaded_filepaths)
                for chunk in stream:
                    if isinstance(chunk, str): resp += chunk
                analyses[s_name] = resp
                self._add_swarm_msg(s_name, f"Analysis complete. Yielding insights.")

        self.swarm_state["phase"] = "SYNTHESIZING"
        self._add_swarm_msg("DIRECTOR", "All insights gathered. Merging data.")

        # Final Synthesis
        yield "🛡️ **Specialist perspectives gathered. Manifesting final synthesis...**\n\n"
        synthesis_prompt = f"""
        User Request: {user_message}
        Specialist Inputs: {json.dumps(analyses)}
        Provide a final unified command response.
        """
        for chunk in call_llm_stream([{"role": "user", "content": synthesis_prompt}], self.model):
            yield chunk
            
        self.swarm_state["phase"] = "IDLE"
        self._add_swarm_msg("DIRECTOR", "Swarm sync complete.")

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
        if mode == "SWARM":
            return self.swarm_state
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
