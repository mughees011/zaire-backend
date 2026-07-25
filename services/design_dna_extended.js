/**
 * ZAIRE Design DNA — Extended Styles + Effects Library
 *
 * Two additions on top of design_dna.js:
 * 1. More AESTHETIC_DNA profiles (glassmorphism, neo-brutalism, memphis, y2k,
 *    bento, swiss, editorial, brutalism, aurora) — same compact palette/type/
 *    motion shape as the original three.
 * 2. EFFECTS_LIBRARY — pre-written, tested animation/interaction snippets
 *    (smooth loaders, physics-based motion, horizontal scroll, scroll-linked
 *    3D tilt, bento layout). The model SELECTS and lightly customizes one of
 *    these instead of freehand-authoring a Three.js scene from scratch —
 *    this is the actual token-savings + reliability mechanism, not a bigger
 *    model or a longer prompt.
 *
 * Honest scope note: none of this attempts true WebGL/Three.js scenes.
 * "3D product scroll" and "3D illustration" below are CSS 3D-transform +
 * scroll-linked framer-motion effects — they read as dimensional without
 * the failure risk of freehand WebGL. If a request needs an actual 3D
 * engine, that's a triage-flag case (see CAPABILITY_RISK_SIGNALS), not
 * something this library pretends to solve.
 */

const EXTENDED_DNA = {
  GLASSMORPHISM: {
    use_when: 'Modern SaaS dashboards, fintech apps, product landing pages wanting a premium-tech feel',
    palette: { background: 'linear-gradient(135deg,#1e1b4b,#0f172a)', surface: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', primary: '#818CF8', text_primary: '#F1F5F9' },
    typography: { display: 'Inter', interface: 'Inter' },
    signature_css: 'backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15);',
    motion: 'Soft fade + scale on entrance, 0.3-0.5s',
    dont_do: ['No opaque cards — blur must be visible', 'No more than 3 blur layers stacked (perf + legibility)']
  },
  NEO_BRUTALISM: {
    use_when: 'Startups wanting bold, confident, anti-corporate energy — indie products, dev tools, creative agencies',
    palette: { background: '#FFF7ED', surface: '#FFFFFF', border: '#000000', primary: '#FF5C00', accent: '#00E5A0', text_primary: '#000000' },
    typography: { display: 'Archivo Black', interface: 'Space Grotesk' },
    signature_css: 'border: 3px solid #000; box-shadow: 6px 6px 0 #000; border-radius: 0;',
    motion: 'Snappy, slight overshoot on hover (translate + shadow shift), 0.15s',
    dont_do: ['No soft shadows', 'No border-radius above 4px', 'No gradients']
  },
  MEMPHIS: {
    use_when: 'Playful consumer brands, youth-oriented products, creative portfolios',
    palette: { background: '#FDF6E3', primary: '#FF3366', accent_1: '#FFD23F', accent_2: '#06D6A0', accent_3: '#7B61FF', text_primary: '#1A1A1A' },
    typography: { display: 'Poppins', interface: 'Poppins' },
    signature_css: 'Squiggle/zigzag decorative shapes, freeform geometric confetti as background accents',
    motion: 'Bouncy spring transitions, playful stagger',
    dont_do: ['No more than 4 accent colors', 'No corporate/serious copy tone paired with this style']
  },
  Y2K: {
    use_when: 'Nostalgia/retro-futurism brands, gen-z consumer products, music/entertainment',
    palette: { background: '#C0C0F5', primary: '#FF00FF', accent: '#00FFFF', chrome: 'linear-gradient(180deg,#fff,#silver,#fff)', text_primary: '#000080' },
    typography: { display: 'Chakra Petch', interface: 'Space Mono' },
    signature_css: 'Chrome/gradient text effects, glossy button highlights, star/sparkle accents',
    motion: 'Glossy hover shine sweep, slight wobble',
    dont_do: ['No minimalist copy — Y2K wants maximalist energy', 'No muted palettes']
  },
  BENTO_GRID: {
    use_when: 'Feature showcases, product pages with many distinct capabilities to display (Apple-style)',
    palette: { background: '#000000', surface: '#111111', border: 'rgba(255,255,255,0.08)', primary: '#0A84FF', text_primary: '#F5F5F7' },
    typography: { display: 'SF Pro Display / Inter', interface: 'Inter' },
    signature_css: 'CSS grid with mixed cell spans (col-span-2, row-span-2), 16-24px gaps, 20px radius per cell',
    motion: 'Subtle scale-on-hover per cell, staggered entrance by grid position',
    dont_do: ['No uniform equal-size grid — the mixed spans ARE the style', 'No more than 2 accent colors across cells']
  },
  SWISS_EDITORIAL: {
    use_when: 'Corporate/professional sites, agencies, publications wanting authority and clarity',
    palette: { background: '#FFFFFF', primary: '#E30613', text_primary: '#000000', text_secondary: '#666666' },
    typography: { display: 'Helvetica Now / Inter', interface: 'Helvetica Now / Inter' },
    signature_css: 'Strict 12-column grid, generous margins, left-aligned text, minimal color (red/black/white only)',
    motion: 'Minimal — fades only, no bounce or spring',
    dont_do: ['No decorative elements', 'No more than one accent color', 'No centered body text']
  },
  AURORA_GRADIENT: {
    use_when: 'AI products, creative tools, modern consumer apps wanting an ethereal/premium feel',
    palette: { background: '#0A0A0F', mesh_colors: ['#7C3AED', '#EC4899', '#3B82F6'], text_primary: '#FFFFFF' },
    typography: { display: 'Inter', interface: 'Inter' },
    signature_css: 'Blurred animated gradient blobs (position: absolute, filter: blur(80px), slow drift animation) behind content',
    motion: 'Very slow gradient drift (20-40s loop), content itself stays calm',
    dont_do: ['No sharp gradient edges — must be heavily blurred', 'No more than 3 mesh colors']
  }
};

// ── EFFECTS LIBRARY ──────────────────────────────────────────────────────────
// Pre-written, tested snippets. The model's job is SELECT + CUSTOMIZE COPY,
// not author animation logic from scratch — this is where the token savings
// and reliability both come from.

const EFFECTS_LIBRARY = {
  smooth_loader: {
    use_when: 'Page/section loading states',
    approach: 'framer-motion opacity+scale pulse, or skeleton screens for content-shaped loading',
    snippet: `<motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-4 bg-white/10 rounded" />`
  },
  physics_animation: {
    use_when: 'Buttons, cards, drag interactions wanting a natural bouncy feel',
    approach: "framer-motion's built-in spring physics — never hand-roll physics math",
    snippet: `<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>`
  },
  horizontal_scroll: {
    use_when: 'Product galleries, case study showcases, "scroll sideways" sections',
    approach: 'CSS scroll-snap on overflow-x, NOT JS-driven scroll hijacking (hijacking breaks accessibility and mobile)',
    snippet: `<div className="flex overflow-x-auto snap-x snap-mandatory gap-6">{items.map(i => <div className="snap-center shrink-0 w-80">{i}</div>)}</div>`
  },
  scroll_linked_3d_tilt: {
    use_when: "Requests for '3D product scroll' or '3D illustration' — this is the honest, reliable version of that ask",
    approach: "framer-motion's useScroll + useTransform mapping scroll position to rotateX/rotateY/perspective — reads as 3D, is actually CSS transforms",
    snippet: `const { scrollYProgress } = useScroll({ target: ref });
const rotateY = useTransform(scrollYProgress, [0, 1], [15, -15]);
<motion.div style={{ rotateY, perspective: 1000 }}>{productImage}</motion.div>`
  },
  parallax_scroll: {
    use_when: 'Depth/layered scroll effects, hero sections wanting motion',
    approach: 'Same useScroll/useTransform pattern, mapping to translateY at different rates per layer',
    snippet: `const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
<motion.div style={{ y }} className="absolute inset-0">{backgroundLayer}</motion.div>`
  }
};

// ── CHART LIBRARY (recharts-based, prop-driven, not freehand SVG) ──────────

const CHART_TEMPLATES = {
  bar_chart: 'recharts <BarChart> with fixed prop shape: { data, xKey, yKey, color }',
  pie_chart: 'recharts <PieChart> with fixed prop shape: { data, nameKey, valueKey, colors[] }',
  line_chart: 'recharts <LineChart> with fixed prop shape: { data, xKey, series[] }'
};

// ── CAPABILITY TRIAGE (from the prior message, extended) ───────────────────

const CAPABILITY_RISK_SIGNALS = {
  true_webgl_3d: /\bwebgl\b|full 3d scene|3d model viewer|gltf|glb model/i,
  realtime_collab: /real-?time collab|live cursors|multiplayer editing/i,
  native_mobile: /native ios|native android|react native app/i
};

function triageRequest(intake) {
  const text = `${intake.what || ''} ${intake.designStyle || ''}`.toLowerCase();
  for (const [risk, pattern] of Object.entries(CAPABILITY_RISK_SIGNALS)) {
    if (pattern.test(text)) return risk;
  }
  return null; // "3d scroll", "3d product", "horizontal scroll" etc. all fall through
               // to EFFECTS_LIBRARY handling below — not flagged, because we DO
               // have a reliable answer for those now.
}

/**
 * Picks 0-2 effects to actually offer the model, based on intake keywords —
 * keeps the prompt short (token discipline) instead of dumping the whole
 * library into every generation call.
 */
function selectEffects(intake) {
  const text = `${intake.what || ''} ${intake.designStyle || ''}`.toLowerCase();
  const picked = [];
  if (/loader|loading/.test(text)) picked.push('smooth_loader');
  if (/physics|bounce|spring/.test(text)) picked.push('physics_animation');
  if (/horizontal scroll/.test(text)) picked.push('horizontal_scroll');
  if (/3d (product|scroll)|3d illustration/.test(text)) picked.push('scroll_linked_3d_tilt');
  if (/parallax/.test(text)) picked.push('parallax_scroll');
  return picked.map((key) => ({ key, ...EFFECTS_LIBRARY[key] }));
}

module.exports = { EXTENDED_DNA, EFFECTS_LIBRARY, CHART_TEMPLATES, triageRequest, selectEffects };
