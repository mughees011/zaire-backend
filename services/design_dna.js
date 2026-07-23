/**
 * ZAIRE Design DNA — Node-native port of design_intelligence.py's knowledge base.
 *
 * WHY THIS FILE EXISTS:
 * design_intelligence.py has excellent, detailed design reasoning (DNA profiles,
 * typography laws, animation choreography, dark-mode rules) — but the JS pipeline
 * that actually runs (engineer_workflow.js, design_intelligence.js) never reads it.
 * `buildGenerationPrompts(brief, plan, intake, profile, dnaKey)` has been sitting
 * there accepting `profile`/`dnaKey` params that nothing ever supplies.
 *
 * This file is the missing supplier: pick a DNA profile from the intake, render
 * it into prompt-ready text, and hand it to buildGenerationPrompts as intended.
 */

const AESTHETIC_DNA = {
  TECH_FUTURISM: {
    use_when: 'AI products, dev tools, SaaS platforms, dashboards, data platforms',
    mood_words: ['Precise', 'Intelligent', 'Fast', 'Dense', 'Alive', 'Systematic'],
    palette: {
      background: '#000000', surface: '#080C10', surface_raised: '#0D1117',
      border: 'rgba(0,212,255,0.12)', primary: '#00D4FF',
      text_primary: '#E6F1FF', text_secondary: 'rgba(230,241,255,0.55)',
      accent_green: '#00FF88', accent_amber: '#FFAA00', accent_red: '#FF4040',
      glow: 'rgba(0,212,255,0.15)'
    },
    typography: {
      display: 'Space Grotesk', display_weight: 700,
      interface: 'Inter', interface_weight: 400, mono: 'JetBrains Mono'
    },
    spacing_philosophy: 'Grid-locked precision. Every element on an 8px grid. Dense but breathable.',
    animation_philosophy: 'Fast and immediate. Feedback is instant. Nothing lingers. 0.12-0.4s durations.',
    corners: '2px (slightly softened, not sharp, not round)',
    special_elements: [
      'Scanline overlay at 2% opacity', 'Subtle grid background at 3-4% opacity',
      'Corner bracket accents on cards (CSS only)', 'Animated number counters for stats',
      'Pulsing status dots for live indicators'
    ],
    dont_do: [
      'No warm colors (yellow/orange/red) as primary', 'No serif fonts',
      'No traditional card borders (use glow instead)', 'No gradients between two different hues'
    ]
  },

  LUXURY_DARK: {
    use_when: 'High-end watches, luxury fashion, premium spirits, exclusive services',
    mood_words: ['Cinematic', 'Restraint', 'Power', 'Editorial', 'Precision', 'Silence'],
    palette: {
      background: '#000000', surface: '#0A0A0A', surface_raised: '#111111',
      border: 'rgba(255,255,255,0.06)', primary: '#C9A84C', primary_muted: '#8B6914',
      text_primary: '#F5F5F5', text_secondary: 'rgba(245,245,245,0.5)',
      glow: 'rgba(201,168,76,0.15)'
    },
    typography: {
      display: 'Cormorant Garamond', display_weight: 300,
      interface: 'Montserrat', interface_weight: 300, mono: 'Space Mono'
    },
    spacing_philosophy: 'EXTREME WHITESPACE. Space is the product. Crowding kills luxury.',
    animation_philosophy: 'Every movement is intentional. Nothing bounces. Nothing rushes. 0.2-1.2s.',
    corners: '0px (sharp edges only — rounds are mass market)',
    dont_do: [
      'No gradients except very subtle dark-to-transparent', 'No bright colors',
      'No more than 2 fonts', 'No equal-size card grids', 'No centered short hero text',
      'No stock photo people smiling at camera', 'No rounded corners above 2px'
    ]
  },

  MINIMAL_LUXURY: {
    use_when: 'Architecture, premium portfolios, high-fashion brands, art galleries, boutique agencies',
    mood_words: ['Breathe', 'Refined', 'Quiet Confidence', 'Timeless', 'Elevated'],
    palette: {
      background: '#FAFAF8', surface: '#FFFFFF', border: 'rgba(0,0,0,0.08)',
      primary: '#1A1A1A', text_primary: '#0A0A0A', text_secondary: 'rgba(10,10,10,0.5)',
      accent: '#8B0000'
    },
    typography: { display: 'Playfair Display', interface: 'Inter' },
    spacing_philosophy: 'Generous, editorial whitespace. Let the work speak.',
    animation_philosophy: 'Subtle, unhurried. Fade and slight movement only.',
    corners: '0px',
    dont_do: ['No dense grids', 'No more than one accent color', 'No busy imagery']
  }
};

// Universal rules that apply regardless of which DNA profile is chosen —
// ported from design_intelligence.py's cross-cutting sections.
const UNIVERSAL_LAWS = `
VISUAL HIERARCHY LAWS (non-negotiable):
- One winner per section. If 3 elements compete at the same visual weight, ruthlessly pick one.
- CTA buttons must never be the same size/weight as body text.
- Subheadlines must read at least 40% smaller than their headline.
- Top-left / top-of-section = read first. Use this for the single most important message.

WHITESPACE:
- Dashboards/data products can be dense. Brand/marketing pages cannot — when in doubt, add more space.
- Body text line-height: 1.6-1.8. Display text: 1.1-1.2. Max line length 65ch.

HERO SECTION RULES:
- Never describe the product in the headline — describe the outcome or feeling.
- Bad: "An AI-powered task management system with integrations"
- Good: "Ship 3x faster. Your AI project manager."

ANIMATION CHOREOGRAPHY:
- Stagger entrances by 0.08-0.12s per element — never animate everything at once.
- Entry order: background instant -> nav (0.1s) -> headline (0.2s) -> subhead (0.35s) -> CTA (0.5s).
- Hover: transform/opacity only, max 0.25s, never change layout dimensions on hover.
- Every async button needs a loading state. Skeleton screens beat spinners.

DARK MODE MASTERY:
- Never pure #000000 background — use #0A0A0A or #080C10 minimum.
- White text at 87% opacity max, never 100%.
- Elevation shown via lighter surfaces, not shadows (shadows don't read on dark).

FINAL CRITIQUE CHECKLIST (the model must self-check before returning any file):
- WCAG AA contrast on every text element?
- One clear visual winner per section?
- 8-point spacing grid respected?
- Works at 375px mobile width?
- Every interactive element has a real hover/focus state?
- Does this feel premium, or does it feel like a template? If template — redo it.
`;

/**
 * Picks the DNA profile key from intake signals. Cheap heuristic — good enough
 * to replace "no DNA selection happens at all," which is the current state.
 */
function selectDnaKey(intake = {}) {
  const style = `${intake.designStyle || ''} ${intake.projectType || ''}`.toLowerCase();
  if (/luxury|watch|fashion|premium spirit|editorial/.test(style)) return 'LUXURY_DARK';
  if (/architecture|gallery|boutique|portfolio/.test(style) && /light|clean|minimal|white/.test(style)) return 'MINIMAL_LUXURY';
  if (/saas|dashboard|ai|dev tool|platform|agent|command center|industrial/.test(style)) return 'TECH_FUTURISM';
  return 'TECH_FUTURISM'; // ZAIRE's own house style as the sane default
}

/**
 * Renders a DNA profile into the `profile` object shape buildGenerationPrompts
 * expects (profile.sections_order, profile.hero_pattern, profile.layout_pattern),
 * plus a full text block to inject into the system prompt.
 */
function buildDnaSystemBlock(dnaKey) {
  const dna = AESTHETIC_DNA[dnaKey] || AESTHETIC_DNA.TECH_FUTURISM;
  return `
DNA PROFILE: ${dnaKey}
Use when: ${dna.use_when}
Mood: ${dna.mood_words.join(', ')}

PALETTE (use these exact values, do not invent new hexes):
${Object.entries(dna.palette).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

TYPOGRAPHY:
- Display: ${dna.typography.display}${dna.typography.display_weight ? ` (weight ${dna.typography.display_weight})` : ''}
- Interface: ${dna.typography.interface}${dna.typography.interface_weight ? ` (weight ${dna.typography.interface_weight})` : ''}
${dna.typography.mono ? `- Mono: ${dna.typography.mono}` : ''}

SPACING: ${dna.spacing_philosophy}
MOTION: ${dna.animation_philosophy}
CORNERS: ${dna.corners}
${dna.special_elements ? `SIGNATURE ELEMENTS: ${dna.special_elements.join('; ')}` : ''}

DO NOT:
${dna.dont_do.map((d) => `- ${d}`).join('\n')}
${UNIVERSAL_LAWS}`;
}

function buildProfileObject(dnaKey) {
  const dna = AESTHETIC_DNA[dnaKey] || AESTHETIC_DNA.TECH_FUTURISM;
  return {
    sections_order: ['Navbar', 'Hero', 'Features', 'Testimonials', 'Pricing', 'FAQ', 'Footer'],
    hero_pattern: dnaKey === 'LUXURY_DARK'
      ? 'Full viewport, bottom-left text, max 6 words, single text-link CTA'
      : 'Centered, badge at top, bold headline max 8 words, primary + ghost CTA, screenshot below fold',
    layout_pattern: dna.spacing_philosophy
  };
}

module.exports = { AESTHETIC_DNA, UNIVERSAL_LAWS, selectDnaKey, buildDnaSystemBlock, buildProfileObject };