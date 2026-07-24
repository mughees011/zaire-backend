import sys
import os
import json
import traceback

THIS_DIR   = os.path.dirname(os.path.abspath(__file__))
SPEC_DIR   = os.path.join(THIS_DIR, "specialists")
sys.path.insert(0, SPEC_DIR)
sys.path.insert(0, THIS_DIR)

try:
    from design_intelligence import (
        WEBSITE_PROFILES,
        DNA_PROFILES,
        ANTI_PATTERNS
    )
except ImportError:
    WEBSITE_PROFILES = {}
    DNA_PROFILES = {}
    ANTI_PATTERNS = {}

def _select_profiles(intake: dict) -> tuple:
    project_type = (intake.get("projectType") or "saas").lower()
    design_style = (intake.get("designStyle") or "").lower()
    reference_sites = (intake.get("referenceSites") or "").lower()

    profile_map = {
        "saas":      "SAAS_LANDING",
        "portfolio": "PORTFOLIO",
        "agent":     "AI_TOOL",
        "mobile":    "SAAS_LANDING",
        "dashboard": "DASHBOARD_APP",
        "custom":    "SAAS_LANDING",
    }
    profile_key = profile_map.get(project_type, "SAAS_LANDING")

    dna_key = "TECH_FUTURISM"
    if any(kw in design_style for kw in ["luxury", "dark", "cinematic", "gold", "watch", "editorial"]):
        dna_key = "LUXURY_DARK"
    elif any(kw in design_style for kw in ["minimal", "clean", "light", "white", "quiet", "calm"]):
        dna_key = "MINIMAL_LUXURY"
    elif any(kw in design_style for kw in ["startup", "modern", "friendly", "bright", "colorful", "indigo"]):
        dna_key = "STARTUP_MODERN"
    elif any(kw in design_style for kw in ["futurist", "tech", "dark", "cyber", "neon", "hud", "command"]):
        dna_key = "TECH_FUTURISM"

    if any(kw in reference_sites for kw in ["rolex", "audemars", "patek", "mrporter", "ssense"]):
        dna_key = "LUXURY_DARK"
    elif any(kw in reference_sites for kw in ["linear", "vercel", "raycast", "cursor", "anthropic"]):
        dna_key = "TECH_FUTURISM"
    elif any(kw in reference_sites for kw in ["leerob", "joshcomeau", "paulgraham"]):
        dna_key = "MINIMAL_LUXURY"

    profile = WEBSITE_PROFILES.get(profile_key, {})
    dna     = DNA_PROFILES.get(dna_key, {})

    return profile_key, dna_key, profile, dna

def _build_brief(intake: dict, plan: dict, profile_key: str, dna_key: str, profile: dict, dna: dict) -> str:
    palette  = json.dumps(dna.get("palette", {}), indent=2)
    typo     = json.dumps(dna.get("typography", {}), indent=2)
    motion   = json.dumps(dna.get("motion", {}), indent=2)
    rules    = json.dumps(dna.get("rules", {}), indent=2)
    spacing  = json.dumps(dna.get("spacing", {}), indent=2)
    must_have = "\n".join(f"  - {item}" for item in profile.get("must_have", []))
    never_do  = "\n".join(f"  - {item}" for item in profile.get("never_do", []))
    mood      = ", ".join(dna.get("mood", []))

    anti = "\n".join(
        f"  [{k}]: {v['description']} -> FIX: {v['fix']}"
        for k, v in list(ANTI_PATTERNS.items())[:5]
    )
    
    workflow = "\n".join(
        f"  - {step.get('phase', step)}: {step.get('purpose', '')}" if isinstance(step, dict) else f"  - {step}"
        for step in (plan.get("workflowPhases") or [])
    ) or "  - Standard Workflow"

    checklist = "\n".join(
        f"  - {step}"
        for step in (plan.get("buildChecklist") or [])
    )

    return f"""
PROJECT BRIEF:
  Name:          {plan.get("appName") or intake.get("projectName", "Unnamed Project")}
  Type:          {profile_key}
  Description:   {intake.get("what", plan.get("summary", ""))}
  Target User:   {intake.get("who", "Professionals")}
  Design Style:  {intake.get("designStyle", "Modern Premium")}
  Reference Sites: {intake.get("referenceSites", "None specified")}
  Deployment:    {intake.get("deploymentTarget", "Vercel")}
  Needs Auth:    {plan.get("needsAuth", False)}
  Needs DB:      {plan.get("needsDatabase", False)}
  Needs Payments:{plan.get("needsPayments", False)}

SELECTED AESTHETIC DNA: {dna_key}
  Mood:     {mood}
  Palette:  {palette}
  Typography: {typo}
  Spacing:  {spacing}
  Motion:   {motion}
  Rules:    {rules}

WEBSITE PROFILE: {profile_key}
  Must Have:
{must_have}
  NEVER Do:
{never_do}

BUILD SEQUENCE:
{workflow}

BUILD CHECKLIST:
{checklist}

ANTI-PATTERNS TO AVOID:
{anti}
"""

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing payload argument."}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
        plan    = payload.get("plan", {})
        intake  = payload.get("intake", {})

        profile_key, dna_key, profile, dna = _select_profiles(intake)
        brief = _build_brief(intake, plan, profile_key, dna_key, profile, dna)

        output = {
            "profile_key": profile_key,
            "dna_key": dna_key,
            "profile": profile,
            "dna": dna,
            "brief": brief
        }
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
