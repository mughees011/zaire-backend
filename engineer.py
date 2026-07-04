"""
ZAIRE ENGINEER MODE — SCAFFOLD ORCHESTRATOR v5.0
Multi-step AI pipeline that produces world-class website scaffolds.
Called by index.js as a subprocess: python engineer.py '<json_payload>'

Pipeline:
  STEP 1: Classify project → select WEBSITE_PROFILE + DNA_PROFILE
  STEP 2: Build a focused design brief from the user's intake
  STEP 3: Generate globals.css with real design tokens via LLM
  STEP 4: Generate tailwind.config.ts with custom palette via LLM
  STEP 5: Generate app/layout.tsx with proper metadata + fonts via LLM
  STEP 6: Generate app/page.tsx (full landing page) via LLM
  STEP 7: Self-review pass — check output against ANTI_PATTERNS
  STEP 8: Return complete file map as JSON
"""

import sys
import os
import json
import re
import traceback

# ── Path setup ────────────────────────────────────────────────────────────────
THIS_DIR   = os.path.dirname(os.path.abspath(__file__))
SPEC_DIR   = os.path.join(THIS_DIR, "specialists")
# Put THIS_DIR first so backend/design_intelligence.py (v4.0) takes priority
# over specialists/design_intelligence.py (which has different exports)
sys.path.insert(0, SPEC_DIR)
sys.path.insert(0, THIS_DIR)

# ── Import the real LLM system (uses the user's configured AI Vault keys) ─────
try:
    from specialists.llm_utils import call_llm_sync
    LLM_AVAILABLE = True
except ImportError:
    try:
        sys.path.insert(0, SPEC_DIR)
        from llm_utils import call_llm_sync
        LLM_AVAILABLE = True
    except ImportError:
        LLM_AVAILABLE = False

# ── Import the Design Intelligence Core ───────────────────────────────────────
try:
    from design_intelligence import (
        WEBSITE_PROFILES,
        DNA_PROFILES,
        ANTI_PATTERNS,
        ENGINEER_SYSTEM_PROTOCOL,
        FILE_TEMPLATES,
        COMPONENT_PATTERNS,
    )
except ImportError:
    WEBSITE_PROFILES = {}
    DNA_PROFILES = {}
    ANTI_PATTERNS = {}
    ENGINEER_SYSTEM_PROTOCOL = ""
    FILE_TEMPLATES = {}
    COMPONENT_PATTERNS = {}


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _strip_markdown(text: str) -> str:
    """Strip markdown code fences if LLM disobeys instructions."""
    text = text.strip()
    # Remove ```css, ```tsx, ```ts, ```json, ```javascript fences
    text = re.sub(r'^```[\w]*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n?```\s*$', '', text, flags=re.MULTILINE)
    return text.strip()


def _call(system: str, user: str, max_tokens: int = 4000, temperature: float = 0.5) -> str:
    """Single LLM call wrapper. Uses the real AI Vault routing."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]
    if LLM_AVAILABLE:
        result = call_llm_sync(messages, temperature=temperature, max_tokens=max_tokens)
        return result or ""
    raise RuntimeError("LLM system not available — ensure specialists/llm_utils.py is importable.")


def _select_profiles(intake: dict) -> tuple:
    """
    STEP 1 — Profile Classification.
    Maps the user's projectType and designStyle to the best WEBSITE_PROFILE + DNA_PROFILE.
    """
    project_type = (intake.get("projectType") or "saas").lower()
    design_style = (intake.get("designStyle") or "").lower()
    reference_sites = (intake.get("referenceSites") or "").lower()

    # Map project type to WEBSITE_PROFILE key
    profile_map = {
        "saas":      "SAAS_LANDING",
        "portfolio": "PORTFOLIO",
        "agent":     "AI_TOOL",
        "mobile":    "SAAS_LANDING",
        "dashboard": "DASHBOARD_APP",
        "custom":    "SAAS_LANDING",
    }
    profile_key = profile_map.get(project_type, "SAAS_LANDING")

    # Map designStyle / keywords to DNA_PROFILE key
    dna_key = "TECH_FUTURISM"  # Smart default
    if any(kw in design_style for kw in ["luxury", "dark", "cinematic", "gold", "watch", "editorial"]):
        dna_key = "LUXURY_DARK"
    elif any(kw in design_style for kw in ["minimal", "clean", "light", "white", "quiet", "calm"]):
        dna_key = "MINIMAL_LUXURY"
    elif any(kw in design_style for kw in ["startup", "modern", "friendly", "bright", "colorful", "indigo"]):
        dna_key = "STARTUP_MODERN"
    elif any(kw in design_style for kw in ["futurist", "tech", "dark", "cyber", "neon", "hud", "command"]):
        dna_key = "TECH_FUTURISM"

    # Also check reference sites for DNA hints
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
    """
    STEP 2 — Build a compact, focused design brief.
    Only includes what the LLM needs — not thousands of tokens of raw dict noise.
    """
    palette  = json.dumps(dna.get("palette", {}), indent=2)
    typo     = json.dumps(dna.get("typography", {}), indent=2)
    motion   = json.dumps(dna.get("motion", {}), indent=2)
    rules    = json.dumps(dna.get("rules", {}), indent=2)
    spacing  = json.dumps(dna.get("spacing", {}), indent=2)
    must_have = "\n".join(f"  - {item}" for item in profile.get("must_have", []))
    never_do  = "\n".join(f"  - {item}" for item in profile.get("never_do", []))
    mood      = ", ".join(dna.get("mood", []))

    anti = "\n".join(
        f"  [{k}]: {v['description']} → FIX: {v['fix']}"
        for k, v in list(ANTI_PATTERNS.items())[:5]
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

ANTI-PATTERNS TO AVOID:
{anti}
"""


# ══════════════════════════════════════════════════════════════════════════════
# GENERATION STEPS
# ══════════════════════════════════════════════════════════════════════════════

BASE_SYSTEM = """You are ZAIRE — an elite senior UI/UX engineer and world-class designer.
You produce premium, human-crafted website code that no other AI can replicate.
Your output is always pure code — NEVER markdown fences, NEVER explanatory text before or after the code.
Every file you generate must feel like it was crafted by a senior designer at a world-class studio.
You strictly follow the Design Brief and DNA Profile provided. You NEVER default to generic output.
"""


def _generate_globals_css(brief: str, dna: dict) -> str:
    system = BASE_SYSTEM + """
You are generating globals.css.
Rules:
- Output ONLY raw CSS. No markdown, no explanation text.
- Define all CSS custom properties (variables) based on the exact palette and typography from the brief.
- Include: CSS reset, body styles, custom scrollbar, ::selection, .container utility, Google Fonts @import.
- Use real Google Fonts that match the DNA typography.
- The result must feel like a premium design system, not a generic reset.
"""
    user = f"""{brief}

Generate globals.css now. Output ONLY the CSS code, starting with @import or :root."""
    return _strip_markdown(_call(system, user, max_tokens=2000, temperature=0.4))


def _generate_tailwind_config(brief: str, dna: dict) -> str:
    system = BASE_SYSTEM + """
You are generating tailwind.config.ts.
Rules:
- Output ONLY valid TypeScript. No markdown, no explanation.
- Use `type { Config } from 'tailwindcss'`.
- Extend theme with: custom colors (from the DNA palette), custom fontFamily (from DNA typography), custom keyframes and animation (fadeUp, fadeIn, gradient-shift), custom screens (xs: 375px).
- Do not use placeholder values — all colors must be real hex values from the design brief.
- Use `require('@tailwindcss/typography')` and `require('@tailwindcss/forms')` in plugins array.
"""
    user = f"""{brief}

Generate tailwind.config.ts now. Output ONLY the TypeScript code."""
    return _strip_markdown(_call(system, user, max_tokens=1500, temperature=0.3))


def _generate_layout_tsx(brief: str, plan: dict, intake: dict) -> str:
    app_name = plan.get("appName") or intake.get("projectName", "Project")
    description = intake.get("what") or plan.get("summary", "")
    system = BASE_SYSTEM + """
You are generating app/layout.tsx for Next.js 14 App Router.
Rules:
- Output ONLY valid TypeScript JSX. No markdown, no explanation.
- Import the Google Fonts that match the DNA (use 'next/font/google').
- Include complete OpenGraph and Twitter card metadata.
- The body tag must apply the font variable classes.
- Include a <link rel="preconnect"> to fonts.googleapis.com.
- Include './globals.css' import.
- The layout must use `suppressHydrationWarning` on the html tag.
"""
    user = f"""{brief}

App Name: {app_name}
Description: {description}
Deployment URL: https://{(app_name).lower().replace(' ', '-')}.vercel.app

Generate app/layout.tsx now. Output ONLY the code starting with imports."""
    return _strip_markdown(_call(system, user, max_tokens=1500, temperature=0.3))


def _generate_page_tsx(brief: str, plan: dict, intake: dict, profile: dict, dna_key: str) -> str:
    sections_order = profile.get("sections_order", [
        "Navbar", "Hero", "Features", "Testimonials", "Pricing", "FAQ", "Footer"
    ])
    app_name    = plan.get("appName") or intake.get("projectName", "Project")
    description = intake.get("what") or plan.get("summary", "")
    target_user = intake.get("who", "professionals")
    hero_pattern = profile.get("hero_pattern", "")
    layout_pattern = profile.get("layout_pattern", "")

    system = BASE_SYSTEM + f"""
You are generating app/page.tsx — the full landing page of the website.
This is the most important file. It must be STUNNING and feel like a world-class design studio built it.

CRITICAL RULES:
- Output ONLY valid TSX code. No markdown fences. No text before or after. Start with 'use client'; or imports.
- Use Tailwind CSS classes exclusively for styling. Inline styles only for CSS variables.
- Write ALL copy contextually — based on the app name, description, and target user. NEVER lorem ipsum.
- Include a complete, functional Navbar with logo and navigation links.
- Include ALL sections in this order: {', '.join(sections_order)}
- Every section must be fully implemented — no placeholder comments like "// add content here".
- Use real data — fake but believable testimonials, feature descriptions, pricing tiers (if SaaS).
- Apply all DNA rules: spacing, border-radius, animation easing, hover states.
- Every button must have hover and focus states.
- Images: use placeholder images via `https://images.unsplash.com` with relevant search terms.
- The page must be mobile responsive (use Tailwind responsive classes: sm:, md:, lg:).

DNA AESTHETIC: {dna_key}
Hero Pattern: {hero_pattern}
Layout Pattern: {layout_pattern}
"""
    user = f"""{brief}

App Name: {app_name}
Description: {description}
Target User: {target_user}

Generate the complete app/page.tsx now. Output ONLY the code."""
    return _strip_markdown(_call(system, user, max_tokens=6000, temperature=0.6))


def _self_review(files: dict, brief: str) -> dict:
    """
    STEP 7 — Self-review pass.
    Ask the LLM to check for any ANTI_PATTERNS and fix the page if needed.
    """
    page_content = files.get("app/page.tsx", {}).get("content", "")
    if not page_content or len(page_content) < 200:
        return files  # Nothing to review

    system = BASE_SYSTEM + """
You are performing a quality review of generated code.
Review the provided app/page.tsx against the Anti-Patterns listed in the brief.
If you find ANY of these issues:
  - Lorem ipsum text
  - Equal-sized feature card grid (all cards same size)
  - Missing hover states on buttons
  - Hardcoded secrets
  - No mobile responsiveness
  - Less than 5 complete sections

Fix them and return the COMPLETE corrected file.
If no issues are found, return the file unchanged.
Output ONLY the raw TSX code. No markdown, no explanation.
"""
    user = f"""{brief}

CURRENT app/page.tsx:
{page_content[:4000]}

Review and return the corrected (or unchanged) complete file."""

    reviewed = _strip_markdown(_call(system, user, max_tokens=6000, temperature=0.3))
    if reviewed and len(reviewed) > 300:
        files["app/page.tsx"]["content"] = reviewed

    return files


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing payload argument."}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
        plan    = payload.get("plan", {})
        intake  = payload.get("intake", {})

        # ── STEP 1: Classify ─────────────────────────────────────────────────
        profile_key, dna_key, profile, dna = _select_profiles(intake)

        # ── STEP 2: Build brief ───────────────────────────────────────────────
        brief = _build_brief(intake, plan, profile_key, dna_key, profile, dna)

        # ── STEP 3: Generate globals.css ──────────────────────────────────────
        globals_css = _generate_globals_css(brief, dna)

        # ── STEP 4: Generate tailwind.config.ts ───────────────────────────────
        tw_config = _generate_tailwind_config(brief, dna)

        # ── STEP 5: Generate app/layout.tsx ──────────────────────────────────
        layout_tsx = _generate_layout_tsx(brief, plan, intake)

        # ── STEP 6: Generate app/page.tsx ─────────────────────────────────────
        page_tsx = _generate_page_tsx(brief, plan, intake, profile, dna_key)

        # ── Assemble file map ─────────────────────────────────────────────────
        files = {
            "app/globals.css": {
                "content": globals_css,
                "explanation": {
                    "what": "AI-generated design system CSS with real tokens from the DNA profile.",
                    "why": "Defines the complete visual identity: colors, fonts, spacing, scrollbar.",
                    "edit": "Adjust CSS variables to tweak the palette without touching components.",
                    "protect": "Keep the :root variables in sync with tailwind.config.ts."
                }
            },
            "tailwind.config.ts": {
                "content": tw_config,
                "explanation": {
                    "what": "AI-generated Tailwind configuration with custom design tokens.",
                    "why": "Extends Tailwind with the project's exact color palette, fonts, and animations.",
                    "edit": "Add new color shades or keyframes as the project grows.",
                    "protect": "Keep content globs aligned with the app directory structure."
                }
            },
            "app/layout.tsx": {
                "content": layout_tsx,
                "explanation": {
                    "what": "Root layout with proper Google Fonts, metadata, and OG tags.",
                    "why": "Ensures SEO, social sharing, and consistent font loading across all pages.",
                    "edit": "Update site name, description, or add providers (theme, auth) here.",
                    "protect": "Keep html/body structure and the font variable class application intact."
                }
            },
            "app/page.tsx": {
                "content": page_tsx,
                "explanation": {
                    "what": "AI-generated full landing page — designed by ZAIRE Design Intelligence Core v4.0.",
                    "why": "Complete, contextual landing page with all required sections for this project type.",
                    "edit": "Update copy, images, pricing, and CTAs to match your real product.",
                    "protect": "Keep Tailwind classes and DNA-consistent spacing. Do not introduce inline styles."
                }
            }
        }

        # ── STEP 7: Self-review ───────────────────────────────────────────────
        files = _self_review(files, brief)

        # ── Output ────────────────────────────────────────────────────────────
        print(json.dumps({"files": files, "profile": profile_key, "dna": dna_key}))

    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
