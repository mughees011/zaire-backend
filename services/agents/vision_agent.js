/**
 * ZAIRE Vision Agent — Advanced Multimodal Analysis Engine
 *
 * This module is the brain of ZAIRE's "Deep Visual Understanding" pillar.
 * When a user provides a reference image (screenshot, sketch, Figma export, etc.),
 * this agent orchestrates a multi-stage multimodal LLM analysis to extract an
 * exhaustive design intelligence payload that the other agents consume directly.
 *
 * Extraction Stages:
 *   1. Global Mood & Aesthetic:   Dark/light, personality, feeling, era.
 *   2. Color System:              Full palette (primary, secondary, accent, surface, border, shadow, gradients).
 *   3. Typography System:         Display, heading, body, mono fonts + sizing scale.
 *   4. Layout & Grid:             Structural hierarchy, grid type, spacing density, breakpoints.
 *   5. Component Inventory:       Named React components visible in the image.
 *   6. Motion & Interaction:      Likely hover states, animations, scroll behaviors.
 *   7. Accessibility Notes:       Contrast risk flags, potential a11y issues.
 *   8. Confidence Score:          How confident the agent is in the extraction (0-1).
 */

// ── STAGE 1: GLOBAL MOOD ─────────────────────────────────────────────────────

function buildMoodSystemPrompt() {
  return `You are ZAIRE's Vision Agent Stage 1: Global Aesthetic Analyst.
Analyze the overall mood and personality of the UI in this image.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "mode": "dark" | "light" | "system",
  "personality": "e.g. professional, playful, brutalist, minimalist, luxury, cyberpunk",
  "era": "e.g. 2024-flat, neo-brutalist, glassmorphism, skeuomorphic, neumorphic",
  "feeling": "e.g. trustworthy, edgy, calm, energetic, sophisticated",
  "density": "sparse" | "medium" | "dense",
  "hasGlassmorphism": true | false,
  "hasGradients": true | false,
  "hasBorderRadius": "none" | "subtle" | "heavy",
  "hasShadows": true | false,
  "animationComplexity": "static" | "subtle" | "rich"
}`;
}

// ── STAGE 2: COLOR SYSTEM ────────────────────────────────────────────────────

function buildColorSystemPrompt() {
  return `You are ZAIRE's Vision Agent Stage 2: Color System Extractor.
Analyze the image and extract every distinct color value you can identify.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "primary": "#hex",
  "primaryHover": "#hex",
  "secondary": "#hex",
  "accent": "#hex",
  "background": "#hex",
  "surface": "#hex",
  "surfaceRaised": "#hex",
  "border": "#hex",
  "text": "#hex",
  "textMuted": "#hex",
  "textInverse": "#hex",
  "error": "#hex or null",
  "success": "#hex or null",
  "warning": "#hex or null",
  "gradients": ["e.g. linear-gradient(135deg, #hex1, #hex2)", "or null if none"]
}
If a value cannot be determined, use null. Use best-effort hex estimation for colors you can observe.`;
}

// ── STAGE 3: TYPOGRAPHY SYSTEM ───────────────────────────────────────────────

function buildTypographySystemPrompt() {
  return `You are ZAIRE's Vision Agent Stage 3: Typography System Analyst.
Analyze the image and extract all typographic design decisions.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "displayFont": "e.g. Inter, Satoshi, Clash Display, or 'unknown-sans-serif'",
  "headingFont": "e.g. same as display or different",
  "bodyFont": "e.g. Inter, Roboto, Geist, or 'unknown-sans-serif'",
  "monoFont": "e.g. JetBrains Mono, Fira Code, or null if none visible",
  "fontWeightScale": {
    "light": "e.g. 300 or null",
    "regular": "e.g. 400",
    "medium": "e.g. 500",
    "semibold": "e.g. 600",
    "bold": "e.g. 700",
    "black": "e.g. 900 or null"
  },
  "headingSizeScale": {
    "h1": "e.g. 64px or 4rem",
    "h2": "e.g. 48px",
    "h3": "e.g. 32px",
    "h4": "e.g. 24px"
  },
  "bodySize": "e.g. 16px",
  "smallSize": "e.g. 14px",
  "lineHeight": "e.g. 1.5",
  "letterSpacing": "e.g. -0.02em or normal",
  "isUppercasedLabels": true | false
}`;
}

// ── STAGE 4: LAYOUT & GRID ───────────────────────────────────────────────────

function buildLayoutSystemPrompt() {
  return `You are ZAIRE's Vision Agent Stage 4: Layout & Grid Architect.
Analyze the structural layout and spatial hierarchy of the UI in this image.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "layoutType": "single-column" | "split-horizontal" | "split-vertical" | "bento-grid" | "masonry" | "dashboard",
  "sectionBreakdown": [
    { "sectionName": "e.g. Navbar", "description": "e.g. sticky top bar with logo left, links center, CTA right", "heightEstimate": "e.g. 64px" },
    { "sectionName": "e.g. Hero", "description": "e.g. full-width with centered text, animated gradient background", "heightEstimate": "e.g. 80vh" }
  ],
  "gridColumns": "e.g. 12-col, 3-col, auto-fit",
  "gapSize": "e.g. 24px or 1.5rem",
  "paddingX": "e.g. 24px, 40px, or 80px for widescreen",
  "paddingY": "e.g. 80px section padding",
  "maxWidth": "e.g. 1280px or null",
  "hasStickySidebar": true | false,
  "hasStickyNav": true | false,
  "isFullBleed": true | false
}`;
}

// ── STAGE 5: COMPONENT INVENTORY ─────────────────────────────────────────────

function buildComponentInventoryPrompt() {
  return `You are ZAIRE's Vision Agent Stage 5: React Component Architect.
Analyze the image and identify every distinct UI component visible. 
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "components": [
    {
      "name": "PascalCase React component name, e.g. HeroSection",
      "description": "Brief description of what it renders",
      "props": ["e.g. title", "subtitle", "ctaText", "backgroundImage"],
      "hasAnimation": true | false,
      "isInteractive": true | false
    }
  ],
  "missingComponents": ["list any standard components you'd expect but can't see, e.g. Footer"]
}`;
}

// ── STAGE 6: MOTION & INTERACTION ────────────────────────────────────────────

function buildMotionSystemPrompt() {
  return `You are ZAIRE's Vision Agent Stage 6: Motion & Interaction Analyst.
Analyze the image and infer what animation and interaction patterns would fit this design.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "entryAnimations": "e.g. fade-up on scroll, staggered card reveal, or none",
  "hoverEffects": "e.g. card lift with shadow, button scale up, underline slide-in",
  "scrollBehavior": "e.g. parallax hero, scroll-driven opacity, sticky headers",
  "transitionDuration": "e.g. 200ms, 300ms",
  "transitionEasing": "e.g. ease-out, cubic-bezier(0.16, 1, 0.3, 1)",
  "cursorEffects": "e.g. custom cursor, magnetic buttons, or none",
  "suggestedLibrary": "e.g. Framer Motion, GSAP, CSS-only, or none"
}`;
}

// ── STAGE 7: ACCESSIBILITY ────────────────────────────────────────────────────

function buildAccessibilityPrompt() {
  return `You are ZAIRE's Vision Agent Stage 7: Accessibility Auditor.
Analyze the image for potential accessibility risks and observations.
Return ONLY valid JSON (no markdown, no prose) with this exact shape:
{
  "contrastRisk": "low" | "medium" | "high",
  "smallTextRisk": true | false,
  "notes": ["e.g. Light gray text on white surface may fail WCAG AA", "Icon-only buttons need aria-labels"],
  "suggestedImprovements": ["e.g. Increase contrast on muted text", "Add focus ring styles"]
}`;
}

// ── SYSTEM CONFIDENCE MERGE ───────────────────────────────────────────────────

/**
 * Validates a single stage's parsed result and applies field-level fallbacks.
 */
function sanitizeStage(result, stageName) {
  if (!result || typeof result !== 'object') {
    console.warn(`[VISION AGENT] Stage ${stageName} returned null or non-object. Using empty fallback.`);
    return {};
  }
  return result;
}

/**
 * Merges all stage payloads into a single unified VisionData object.
 * Any null stage is replaced with an empty object so downstream agents
 * don't crash on missing keys.
 */
function mergeVisionPayload({ mood, colors, typography, layout, components, motion, accessibility }) {
  const safeComponents = (components?.components || []).map(c => c?.name).filter(Boolean);

  return {
    // Mood
    mode: mood?.mode || 'dark',
    personality: mood?.personality || 'modern',
    era: mood?.era || '2024-flat',
    feeling: mood?.feeling || 'professional',
    density: mood?.density || 'medium',
    hasGlassmorphism: mood?.hasGlassmorphism ?? false,
    hasGradients: mood?.hasGradients ?? false,
    hasBorderRadius: mood?.hasBorderRadius || 'subtle',
    hasShadows: mood?.hasShadows ?? true,
    animationComplexity: mood?.animationComplexity || 'subtle',

    // Colors
    colorPalette: {
      primary: colors?.primary || '#6366f1',
      primaryHover: colors?.primaryHover || null,
      secondary: colors?.secondary || null,
      accent: colors?.accent || '#22d3ee',
      background: colors?.background || '#09090b',
      surface: colors?.surface || '#18181b',
      surfaceRaised: colors?.surfaceRaised || null,
      border: colors?.border || '#27272a',
      text: colors?.text || '#fafafa',
      textMuted: colors?.textMuted || '#a1a1aa',
      textInverse: colors?.textInverse || '#09090b',
      error: colors?.error || null,
      success: colors?.success || null,
      warning: colors?.warning || null,
      gradients: colors?.gradients || []
    },

    // Typography
    typography: {
      displayFont: typography?.displayFont || 'Inter',
      headingFont: typography?.headingFont || typography?.displayFont || 'Inter',
      bodyFont: typography?.bodyFont || 'Inter',
      monoFont: typography?.monoFont || null,
      fontWeightScale: typography?.fontWeightScale || { regular: '400', semibold: '600', bold: '700' },
      headingSizeScale: typography?.headingSizeScale || { h1: '4rem', h2: '3rem', h3: '2rem', h4: '1.5rem' },
      bodySize: typography?.bodySize || '16px',
      smallSize: typography?.smallSize || '14px',
      lineHeight: typography?.lineHeight || '1.6',
      letterSpacing: typography?.letterSpacing || 'normal',
      isUppercasedLabels: typography?.isUppercasedLabels ?? false
    },

    // Layout
    layout: {
      layoutType: layout?.layoutType || 'single-column',
      sectionBreakdown: layout?.sectionBreakdown || [],
      gridColumns: layout?.gridColumns || '12-col',
      gapSize: layout?.gapSize || '24px',
      paddingX: layout?.paddingX || '40px',
      paddingY: layout?.paddingY || '80px',
      maxWidth: layout?.maxWidth || '1280px',
      hasStickySidebar: layout?.hasStickySidebar ?? false,
      hasStickyNav: layout?.hasStickyNav ?? true,
      isFullBleed: layout?.isFullBleed ?? false
    },

    // Components
    components: safeComponents,
    componentDetails: components?.components || [],
    missingComponents: components?.missingComponents || [],

    // Motion
    motion: {
      entryAnimations: motion?.entryAnimations || 'fade-up on scroll',
      hoverEffects: motion?.hoverEffects || 'card lift with shadow',
      scrollBehavior: motion?.scrollBehavior || 'none',
      transitionDuration: motion?.transitionDuration || '300ms',
      transitionEasing: motion?.transitionEasing || 'ease-out',
      cursorEffects: motion?.cursorEffects || 'none',
      suggestedLibrary: motion?.suggestedLibrary || 'Framer Motion'
    },

    // Accessibility
    accessibility: {
      contrastRisk: accessibility?.contrastRisk || 'low',
      smallTextRisk: accessibility?.smallTextRisk ?? false,
      notes: accessibility?.notes || [],
      suggestedImprovements: accessibility?.suggestedImprovements || []
    }
  };
}

/**
 * Parses a raw LLM text response into JSON, safely.
 */
function safeParseLLMJson(content, stageName) {
  try {
    const cleaned = content.replace(/^```(json)?\n?|\n?```\s*$/gm, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn(`[VISION AGENT] Stage ${stageName} JSON parse failed:`, e.message);
    return null;
  }
}

/**
 * Core exported function — runs a 7-stage multimodal analysis on the reference image.
 *
 * @param {string} imageUrl - A URL or base64 data URI of the reference image.
 * @param {Function} llmCall - The executeLLMCallWithFailover function from index.js.
 * @param {Function} emitEvent - The emitEngineerEvent function from index.js.
 * @param {Object} req - Express request object (passed to emitEvent).
 * @returns {Object} A unified VisionData payload, or null on total failure.
 */
async function runVisionAnalysis(imageUrl, llmCall, emitEvent, req) {
  const stages = [
    { name: 'Mood & Aesthetic',      system: buildMoodSystemPrompt(),           key: 'mood' },
    { name: 'Color System',           system: buildColorSystemPrompt(),          key: 'colors' },
    { name: 'Typography System',      system: buildTypographySystemPrompt(),     key: 'typography' },
    { name: 'Layout & Grid',          system: buildLayoutSystemPrompt(),         key: 'layout' },
    { name: 'Component Inventory',    system: buildComponentInventoryPrompt(),   key: 'components' },
    { name: 'Motion & Interaction',   system: buildMotionSystemPrompt(),         key: 'motion' },
    { name: 'Accessibility',          system: buildAccessibilityPrompt(),        key: 'accessibility' }
  ];

  const results = {};

  for (const stage of stages) {
    try {
      emitEvent(req, 'PLAN_STARTED', `Vision Agent → Analyzing ${stage.name}...`, 'running');

      const res = await llmCall({
        messages: [
          { role: 'system', content: stage.system },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze this UI design image and extract the ${stage.name} information.` },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 900
      });

      const content = res?.choices?.[0]?.message?.content;
      if (content) {
        results[stage.key] = sanitizeStage(safeParseLLMJson(content, stage.name), stage.name);
        console.log(`[VISION AGENT] Stage "${stage.name}" ✓`);
      } else {
        console.warn(`[VISION AGENT] Stage "${stage.name}" returned empty content.`);
        results[stage.key] = {};
      }
    } catch (err) {
      console.warn(`[VISION AGENT] Stage "${stage.name}" failed:`, err.message);
      results[stage.key] = {};
    }
  }

  emitEvent(req, 'PLAN_STARTED', 'Vision Agent → Merging all signals into design intelligence...', 'running');
  const merged = mergeVisionPayload(results);

  // Summary log for server console
  console.log('[VISION AGENT] ✅ Full extraction complete:');
  console.log(`  Mode: ${merged.mode} | Era: ${merged.era} | Personality: ${merged.personality}`);
  console.log(`  Primary: ${merged.colorPalette.primary} | BG: ${merged.colorPalette.background}`);
  console.log(`  Display Font: ${merged.typography.displayFont} | Body: ${merged.typography.bodyFont}`);
  console.log(`  Layout: ${merged.layout.layoutType} | Sections: ${merged.layout.sectionBreakdown.length}`);
  console.log(`  Components found: ${merged.components.join(', ')}`);
  console.log(`  Motion Library: ${merged.motion.suggestedLibrary}`);
  console.log(`  A11y Risk: ${merged.accessibility.contrastRisk}`);

  return merged;
}

// ── LEGACY COMPATIBILITY (used by old single-stage path if needed) ─────────────
function buildVisionExtractionPrompt() {
  return {
    system: buildMoodSystemPrompt(),
    user: 'Please analyze this image.'
  };
}

module.exports = { runVisionAnalysis, buildVisionExtractionPrompt, mergeVisionPayload };
