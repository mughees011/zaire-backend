"""
ZAIRE ENGINEER MODE — DESIGN INTELLIGENCE CORE v4.0
The brain that makes ZAIRE produce better websites than any other AI.
This file is imported by engineer.py and loaded into every build context.
"""

# ═══════════════════════════════════════════════════════════════
# 1. WEBSITE TYPE PROFILES
# ═══════════════════════════════════════════════════════════════

WEBSITE_PROFILES = {

    "PORTFOLIO": {
        "description": "Personal portfolios, creative showcases, designer/developer sites",
        "reference_sites": ["vercel.com/blog", "linear.app", "rauno.me", "bruno-simon.com"],
        "layout_pattern": "Full-viewport sections, horizontal scroll gallery, custom cursor",
        "nav_style": "Minimal overlay — logo left, 2-3 links right, no visible nav on scroll",
        "hero_pattern": "Name large + role small + one signature animation",
        "color_approach": "Monochrome with ONE strong accent. Never rainbow.",
        "animation_language": "Smooth, spring-physics, purposeful. Nothing decorative.",
        "must_have": [
            "Custom cursor with hover state changes",
            "Smooth scroll (Lenis)",
            "Work grid with hover preview",
            "Case study pages with full-bleed imagery",
            "Contact section not a form — just an email link",
        ],
        "never_do": [
            "Animated loading screen longer than 1.5s",
            "Auto-playing audio",
            "Testimonials section",
            "Skills bar charts (embarrassing)",
            "Download CV button as primary CTA",
        ],
        "tech_stack": {
            "framework": "Next.js 14 App Router",
            "styling": "Tailwind CSS + CSS Variables",
            "animation": "Framer Motion + Lenis smooth scroll",
            "deployment": "Vercel",
        },
        "performance_budget": {
            "LCP": "< 2.0s",
            "lighthouse": "> 92",
            "bundle_size": "< 200KB JS",
        }
    },

    "SAAS_LANDING": {
        "description": "SaaS product landing pages, software marketing sites",
        "reference_sites": ["linear.app", "vercel.com", "cursor.so", "raycast.com", "loom.com"],
        "layout_pattern": "Hero → Social proof → Feature bento grid → Pricing → CTA",
        "nav_style": "Sticky, blur background on scroll, primary CTA button top-right",
        "hero_pattern": "Badge → Headline (6 words max) → Subheading → 2 CTAs → Product screenshot",
        "color_approach": "One brand color. Dark or light — commit fully. No gradient rainbow.",
        "animation_language": "Snappy (0.2s), immediate feedback, no lingering",
        "must_have": [
            "Social proof: logos or number stats above fold",
            "Feature bento grid with varied card sizes",
            "Pricing section with toggle (monthly/annual)",
            "Testimonial carousel or wall",
            "FAQ accordion",
            "Footer with full link tree",
            "Open Graph meta for social sharing",
        ],
        "never_do": [
            "Equal-sized feature card grid (boring)",
            "Rotating hero text (gimmicky)",
            "More than 2 primary CTAs competing",
            "Pricing page behind a link — put it on landing",
            "Chat widget covering the CTA",
        ],
        "tech_stack": {
            "framework": "Next.js 14 App Router",
            "styling": "Tailwind CSS",
            "animation": "Framer Motion",
            "ui_components": "shadcn/ui",
            "deployment": "Vercel",
        },
        "sections_order": [
            "Navbar",
            "Hero (with product visual)",
            "Social proof bar (logos/stats)",
            "Problem statement",
            "Feature grid (bento)",
            "How it works (3 steps)",
            "Testimonials",
            "Pricing",
            "FAQ",
            "Final CTA banner",
            "Footer",
        ]
    },

    "ECOMMERCE_LUXURY": {
        "description": "High-end product stores, luxury goods, watches, fashion",
        "reference_sites": ["rolex.com", "audemarspiguet.com", "mrporter.com", "ssense.com"],
        "layout_pattern": "Full-bleed photography → Product narrative → Editorial grid",
        "nav_style": "Transparent on hero, center-aligned links, logo left",
        "hero_pattern": "Full-viewport product photography, bottom-left text, one word CTA",
        "color_approach": "Dark background + gold OR pure white + black. Never both.",
        "animation_language": "Slow (0.6-0.8s), deliberate, cinematic ease-out",
        "must_have": [
            "Full-bleed product photography (no rounded corners on images)",
            "Horizontal scroll product gallery",
            "Product detail with zoom capability",
            "Size/variant selector with smooth transitions",
            "Sticky add-to-cart that appears on scroll",
            "Shipping/returns info accessible but not prominent",
            "Editorial content mixed with product",
        ],
        "never_do": [
            "Rounded corners on product images",
            "Sale badges or discount %",
            "Countdown timers",
            "Pop-up discount offer",
            "Stock urgency messages ('Only 2 left!')",
        ],
        "tech_stack": {
            "framework": "Next.js 14",
            "styling": "Tailwind CSS + Custom CSS",
            "animation": "GSAP + Framer Motion",
            "payments": "Stripe",
            "cms": "Sanity.io",
            "images": "Cloudinary",
            "deployment": "Vercel",
        }
    },

    "DASHBOARD_APP": {
        "description": "Admin panels, analytics dashboards, SaaS app interiors",
        "reference_sites": ["linear.app (app)", "vercel.com (dashboard)", "planetscale.com"],
        "layout_pattern": "Sidebar nav (240px) + Top bar + Main content area",
        "nav_style": "Persistent left sidebar with icon + label, collapsible to icon-only",
        "color_approach": "Dark mode primary. Light mode must be equally designed.",
        "animation_language": "Fast (0.12-0.2s), no decorative animations, only functional",
        "must_have": [
            "Command palette (Cmd+K) for power users",
            "Skeleton loading states — never spinners",
            "Empty states that are designed, not blank",
            "Keyboard navigation throughout",
            "Toast notifications (not alerts)",
            "Data tables with sort/filter/search",
            "Mobile: bottom tab bar (not hamburger)",
        ],
        "never_do": [
            "Blocking modals for simple actions",
            "Full page reloads for any interaction",
            "Data tables without sort capability",
            "Loading spinners (use skeletons)",
            "Sidebar that pushes content (use overlay)",
        ],
        "tech_stack": {
            "framework": "Next.js 14 App Router",
            "styling": "Tailwind CSS",
            "ui": "shadcn/ui",
            "state": "Zustand",
            "data": "TanStack Query",
            "charts": "Recharts or Tremor",
            "tables": "TanStack Table",
            "deployment": "Vercel",
        }
    },

    "AGENCY_STUDIO": {
        "description": "Creative agencies, design studios, production companies",
        "reference_sites": ["heco.io", "locomotive.ca", "buildinamsterdam.com"],
        "layout_pattern": "Immersive scrolling, full-viewport sections, work-first",
        "nav_style": "Minimal, often just hamburger → full-screen overlay",
        "hero_pattern": "Large typography statement + reel or static work preview",
        "color_approach": "Strong brand color identity. Unexpected combinations.",
        "animation_language": "GSAP ScrollTrigger, parallax, horizontal scroll sections",
        "must_have": [
            "Reel or showreel video (autoplay, muted)",
            "Client logo grid",
            "Work grid with hover video preview",
            "Awards/recognition section",
            "Team section with personality",
            "Custom page transitions",
        ],
        "tech_stack": {
            "framework": "Next.js 14",
            "animation": "GSAP + ScrollTrigger + Lenis",
            "3d": "Three.js (optional)",
            "deployment": "Vercel",
        }
    },

    "BLOG_EDITORIAL": {
        "description": "Content sites, publications, newsletters, knowledge bases",
        "reference_sites": ["leerob.io", "joshwcomeau.com", "paulgraham.com"],
        "layout_pattern": "Clean article list → Full-width article → TOC sidebar",
        "color_approach": "Light mode primary for readability. Dark mode secondary.",
        "must_have": [
            "Reading time estimate",
            "Table of contents (sticky on desktop)",
            "Code syntax highlighting",
            "MDX support for interactive content",
            "RSS feed",
            "OG image generation per article",
            "Search functionality",
        ],
        "tech_stack": {
            "framework": "Next.js 14",
            "content": "MDX or Contentlayer",
            "styling": "Tailwind CSS with prose plugin",
            "deployment": "Vercel",
        }
    },

    "AI_TOOL": {
        "description": "AI products, ML tools, API-powered services",
        "reference_sites": ["anthropic.com", "openai.com", "replicate.com", "huggingface.co"],
        "layout_pattern": "Dark hero → capability demos → technical credibility → pricing",
        "color_approach": "Dark background. Gradient accents acceptable for AI.",
        "must_have": [
            "Live demo or interactive preview in hero",
            "Technical specifications visible (not hidden)",
            "API documentation link prominent",
            "Rate limits and pricing transparent",
            "Trust signals: SOC2, GDPR compliance badges",
            "GitHub link if open source",
        ],
        "tech_stack": {
            "framework": "Next.js 14",
            "styling": "Tailwind CSS",
            "animation": "Framer Motion",
            "deployment": "Vercel",
        }
    }
}

# ═══════════════════════════════════════════════════════════════
# 2. DNA PROFILES — Complete aesthetic specifications
# ═══════════════════════════════════════════════════════════════

DNA_PROFILES = {

    "LUXURY_DARK": {
        "use_for": ["ECOMMERCE_LUXURY", "PORTFOLIO", "AGENCY_STUDIO"],
        "mood": ["Cinematic", "Restraint", "Authority", "Precision"],
        "palette": {
            "background": "#000000",
            "surface": "#0A0A0A",
            "surface_raised": "#111111",
            "border": "rgba(255,255,255,0.06)",
            "primary": "#C9A84C",
            "text_primary": "#F5F5F5",
            "text_secondary": "rgba(245,245,245,0.5)",
            "text_muted": "rgba(245,245,245,0.25)",
        },
        "typography": {
            "display_font": "Cormorant Garamond",
            "display_weight": "300",
            "ui_font": "Montserrat",
            "ui_weight": "300",
            "mono_font": "Space Mono",
            "hero_size": "clamp(56px,8vw,120px)",
            "hero_tracking": "0.12em",
            "ui_tracking": "0.06em",
            "line_height_body": "1.8",
        },
        "spacing": {
            "section_gap": "160px",
            "component_gap": "80px",
            "padding_section": "120px 80px",
            "padding_card": "48px",
        },
        "motion": {
            "duration_fast": "0.3s",
            "duration_standard": "0.6s",
            "duration_slow": "1.2s",
            "easing": "cubic-bezier(0.25,0,0,1)",
            "hover_scale": "1.02",
        },
        "rules": {
            "border_radius": "0px",
            "border_width": "0.5px",
            "shadows": "Use glow only. rgba(201,168,76,0.12) spread.",
            "images": "Full-bleed. Never rounded. B&W or desaturated preferred.",
        }
    },

    "TECH_FUTURISM": {
        "use_for": ["SAAS_LANDING", "AI_TOOL", "DASHBOARD_APP"],
        "mood": ["Precise", "Fast", "Intelligent", "Systematic"],
        "palette": {
            "background": "#000000",
            "surface": "#080C10",
            "surface_raised": "#0D1117",
            "border": "rgba(0,212,255,0.12)",
            "primary": "#00D4FF",
            "accent_green": "#00FF88",
            "accent_amber": "#FFAA00",
            "text_primary": "#E6F1FF",
            "text_secondary": "rgba(230,241,255,0.55)",
            "text_muted": "rgba(230,241,255,0.25)",
        },
        "typography": {
            "display_font": "Space Grotesk",
            "display_weight": "700",
            "ui_font": "Inter",
            "ui_weight": "400",
            "mono_font": "JetBrains Mono",
            "hero_size": "clamp(40px,6vw,80px)",
            "hero_tracking": "0.02em",
            "ui_tracking": "0.01em",
        },
        "spacing": {
            "section_gap": "100px",
            "component_gap": "48px",
            "padding_section": "80px 60px",
            "padding_card": "24px",
            "grid_base": "8px",
        },
        "motion": {
            "duration_fast": "0.12s",
            "duration_standard": "0.2s",
            "duration_slow": "0.4s",
            "easing": "cubic-bezier(0.4,0,0.2,1)",
            "hover_glow": "box-shadow expand + border brighten",
        },
        "rules": {
            "border_radius": "4px",
            "border_width": "1px",
            "shadows": "Glow only. No drop shadows.",
            "special": "Scanline overlay 2% opacity, tactical grid background 3% opacity",
        }
    },

    "MINIMAL_LUXURY": {
        "use_for": ["PORTFOLIO", "AGENCY_STUDIO", "BLOG_EDITORIAL"],
        "mood": ["Breathe", "Quiet Confidence", "Timeless", "Elevated"],
        "palette": {
            "background": "#FAFAF8",
            "surface": "#FFFFFF",
            "border": "rgba(0,0,0,0.08)",
            "primary": "#1A1A1A",
            "accent": "#8B0000",
            "text_primary": "#0A0A0A",
            "text_secondary": "rgba(10,10,10,0.5)",
            "text_muted": "rgba(10,10,10,0.25)",
        },
        "typography": {
            "display_font": "Playfair Display",
            "display_weight": "400",
            "ui_font": "Syne",
            "ui_weight": "300",
            "hero_size": "clamp(64px,9vw,140px)",
            "line_height_body": "1.9",
            "ui_tracking": "0.1em",
        },
        "spacing": {
            "section_gap": "200px",
            "component_gap": "120px",
            "padding_section": "160px 100px",
        },
        "motion": {
            "duration_standard": "0.8s",
            "duration_slow": "1.4s",
            "easing": "cubic-bezier(0.16,1,0.3,1)",
            "scroll_reveal": "opacity fade only, no translate",
        },
        "rules": {
            "border_radius": "0px",
            "borders": "1px solid — or none at all",
        }
    },

    "STARTUP_MODERN": {
        "use_for": ["SAAS_LANDING", "AI_TOOL", "DASHBOARD_APP"],
        "mood": ["Friendly", "Confident", "Clear", "Accessible"],
        "palette": {
            "background": "#FFFFFF",
            "surface": "#F8FAFC",
            "primary": "#6366F1",
            "primary_dark": "#4F46E5",
            "text_primary": "#0F172A",
            "text_secondary": "#64748B",
            "accent": "#F59E0B",
            "border": "rgba(0,0,0,0.08)",
        },
        "typography": {
            "display_font": "Inter",
            "display_weight": "700",
            "ui_font": "Inter",
            "ui_weight": "400",
            "hero_size": "clamp(40px,5vw,72px)",
            "line_height_body": "1.7",
        },
        "spacing": {
            "section_gap": "96px",
            "component_gap": "48px",
            "padding_card": "32px",
        },
        "motion": {
            "duration_standard": "0.3s",
            "easing": "cubic-bezier(0.34,1.56,0.64,1)",
            "hover_scale": "1.03",
        },
        "rules": {
            "border_radius": "12px",
            "shadows": "Soft multi-layer: 0 1px 3px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)",
        }
    },

    "NOXR_SIGNATURE": {
        "use_for": ["ECOMMERCE_LUXURY"],
        "mood": ["Dark Authority", "Watch Culture", "Editorial Precision"],
        "palette": {
            "background": "#000000",
            "surface": "#080808",
            "primary": "#C9A84C",
            "text_primary": "#FFFFFF",
            "text_secondary": "rgba(255,255,255,0.5)",
            "sapphire": "#0047AB",
        },
        "typography": {
            "display_font": "Cormorant Garamond",
            "ui_font": "Montserrat",
            "hero_size": "clamp(48px,7vw,100px)",
            "hero_weight": "300",
            "hero_tracking": "0.2em",
        },
        "reference_sites": [
            "rolex.com — full-bleed photography, product-first",
            "audemarspiguet.com — dark editorial, video bg",
            "patek.com — typography-led luxury",
        ],
        "differentiation": [
            "NOXR is rawer and more cinematic than Rolex",
            "Inject motion where Rolex uses stillness",
            "Typography-forward hero, watch as supporting element",
        ]
    }
}

# ═══════════════════════════════════════════════════════════════
# 3. COMPONENT LIBRARY — Production patterns per type
# ═══════════════════════════════════════════════════════════════

COMPONENT_PATTERNS = {

    "HERO_PATTERNS": {
        "LUXURY_PRODUCT": {
            "structure": [
                "Full viewport height, product photography background",
                "Text: bottom-left anchored, never centered",
                "Eyebrow: 10px caps, muted, letter-spacing 0.3em",
                "Headline: Display font, ultra-large, weight 300",
                "CTA: Text link + arrow, no button box on dark",
                "Scroll indicator: thin vertical line + 'scroll'",
            ],
            "never": "Centered text, generic CTA button",
        },
        "SAAS_CENTERED": {
            "structure": [
                "Badge: pill with version/status at very top",
                "Headline: Bold, max 8 words, gradient optional",
                "Subheading: 2-3 lines, secondary color",
                "CTAs: Primary solid + Ghost side by side",
                "Product screenshot or interactive demo below",
                "Social proof: avatars + star rating below CTAs",
            ],
            "never": "More than 2 CTAs, hero text over 10 words",
        },
        "EDITORIAL_TYPE": {
            "structure": [
                "Full height, typography IS the design",
                "Oversized display text, possibly rotated",
                "Minimal or zero images",
                "One accent color element maximum",
            ]
        }
    },

    "NAVBAR_PATTERNS": {
        "TRANSPARENT_SCROLL": {
            "behavior": "Transparent on hero, adds backdrop-blur at 100px scroll",
            "height": "72px",
            "code": """
// Navbar.tsx
const [scrolled, setScrolled] = useState(false);
useEffect(() => {
  const handleScroll = () => setScrolled(window.scrollY > 80);
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

className={cn(
  "fixed top-0 w-full z-50 transition-all duration-300",
  scrolled
    ? "bg-black/80 backdrop-blur-xl border-b border-white/10"
    : "bg-transparent"
)}"""
        },
        "FLOATING_PILL": {
            "behavior": "Not full-width. Pill shape, floating above content",
            "code": """
// Centered pill navbar
<nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50
  bg-white/10 backdrop-blur-xl border border-white/20
  rounded-full px-6 py-3 flex items-center gap-6
  shadow-xl shadow-black/20">
"""
        }
    },

    "CARD_PATTERNS": {
        "GLASS_CARD": """
.card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-top: 1px solid rgba(255,255,255,0.2);
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
}
.card:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
  transform: translateY(-2px);
}""",
        "BENTO_CARD": """
/* Bento grid — NEVER equal sizes */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 16px;
}
/* Large feature card spans 2 columns */
.bento-card-large { grid-column: span 2; }
/* Always mix sizes: 1x1, 2x1, 1x2 */""",
        "HOVER_REVEAL": """
/* Product card with hover reveal */
.product-card { overflow: hidden; }
.product-card img {
  transition: transform 0.6s cubic-bezier(0.25,0,0,1);
}
.product-card:hover img { transform: scale(1.05); }
/* Never scale the whole card — only the image */"""
    },

    "BUTTON_PATTERNS": {
        "LUXURY_OUTLINE": """
.btn-luxury {
  background: transparent;
  border: 0.5px solid rgba(201,168,76,0.6);
  color: #C9A84C;
  padding: 14px 40px;
  font-family: 'Montserrat', sans-serif;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  transition: all 0.4s ease;
  border-radius: 0;
  cursor: pointer;
}
.btn-luxury:hover {
  background: #C9A84C;
  color: #000;
}""",
        "TECH_PRIMARY": """
.btn-tech {
  background: var(--primary);
  color: white;
  padding: 10px 24px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-tech:hover {
  opacity: 0.9;
  box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.3);
}""",
        "GHOST": """
.btn-ghost {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.8);
  padding: 10px 24px;
  border-radius: 6px;
  transition: all 0.15s;
  cursor: pointer;
}
.btn-ghost:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.35);
  color: white;
}"""
    },

    "ANIMATION_PATTERNS": {
        "SCROLL_REVEAL": """
// components/ScrollReveal.tsx
'use client';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export function ScrollReveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25,0,0,1] }}
    >
      {children}
    </motion.div>
  );
}""",
        "STAGGER_CHILDREN": """
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 }
  }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25,0,0,1] } }
};""",
        "SMOOTH_SCROLL": """
// app/providers.tsx
'use client';
import Lenis from '@studio-freight/lenis';
import { useEffect } from 'react';

export function SmoothScroll({ children }) {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smooth: true });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);
  return <>{children}</>;
}""",
        "TEXT_GRADIENT": """
/* Animated gradient text */
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
/* Moving gradient */
.gradient-text-animated {
  background: linear-gradient(90deg, #00d4ff, #a78bfa, #f97316, #00d4ff);
  background-size: 300%;
  animation: gradient-shift 4s linear infinite;
}
@keyframes gradient-shift { 0%{background-position:0%} 100%{background-position:300%} }"""
    }
}

# ═══════════════════════════════════════════════════════════════
# 4. FULL FILE TEMPLATES — Production-ready starting files
# ═══════════════════════════════════════════════════════════════

FILE_TEMPLATES = {

    "globals_css_dark": """
/* ═══════════════ GLOBALS.CSS — DARK LUXURY ═══════════════ */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Montserrat:wght@300;400;500&display=swap');

:root {
  --bg:          #000000;
  --surface:     #0A0A0A;
  --primary:     #C9A84C;
  --text:        rgba(245,245,245,0.92);
  --text-muted:  rgba(245,245,245,0.45);
  --border:      rgba(255,255,255,0.06);
  --font-display:'Cormorant Garamond', Georgia, serif;
  --font-ui:     'Montserrat', system-ui, sans-serif;
  --ease:        cubic-bezier(0.25,0,0,1);
  --dur:         0.6s;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: auto; } /* Lenis handles smoothness */
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }

/* Selection */
::selection { background: var(--primary); color: #000; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

/* Utility */
.container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 40px; }
.section { padding: var(--section-gap, 120px) 0; }
""",

    "globals_css_light": """
/* ═══════════════ GLOBALS.CSS — MINIMAL LIGHT ═══════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --bg:         #FAFAF8;
  --surface:    #FFFFFF;
  --primary:    #0F172A;
  --accent:     #6366F1;
  --text:       rgba(15,23,42,0.9);
  --text-muted: rgba(15,23,42,0.5);
  --border:     rgba(0,0,0,0.08);
  --font:       'Inter', system-ui, sans-serif;
  --ease:       cubic-bezier(0.16,1,0.3,1);
  --dur:        0.4s;
  --radius:     12px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}

.container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 48px; }
@media (max-width: 768px) { .container { padding: 0 20px; } }
""",

    "layout_tsx": """
// app/layout.tsx
import type { Metadata } from 'next';
import { generateMetadata as genMeta } from '@/lib/metadata';
import './globals.css';

export const metadata: Metadata = {
  title: { template: '%s | {SITE_NAME}', default: '{SITE_NAME}' },
  description: '{SITE_DESCRIPTION}',
  openGraph: {
    title: '{SITE_NAME}',
    description: '{SITE_DESCRIPTION}',
    url: '{SITE_URL}',
    siteName: '{SITE_NAME}',
    images: [{ url: '{OG_IMAGE_URL}', width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '{SITE_NAME}',
    description: '{SITE_DESCRIPTION}',
    images: ['{OG_IMAGE_URL}'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico', apple: '/apple-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
""",

    "tailwind_config": """
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        surface: 'var(--surface)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.25,0,0,1) forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'spin-slow': 'spin 8s linear infinite',
        'gradient': 'gradient 4s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
export default config;
"""
}

# ═══════════════════════════════════════════════════════════════
# 5. PERFORMANCE STANDARDS — Non-negotiable quality gates
# ═══════════════════════════════════════════════════════════════

PERFORMANCE_STANDARDS = {
    "lighthouse_targets": {
        "performance": 90,
        "accessibility": 95,
        "best_practices": 100,
        "seo": 100,
    },
    "core_web_vitals": {
        "LCP": "< 2.5s",
        "FID": "< 100ms",
        "CLS": "< 0.1",
        "INP": "< 200ms",
    },
    "image_rules": [
        "Always use next/image — never raw <img> tags",
        "WebP format required",
        "Always specify width and height to prevent CLS",
        "Use blur placeholder for loading state",
        "Hero images: priority={true}",
        "Below fold: lazy loading (default)",
    ],
    "font_rules": [
        "Max 2 font families",
        "font-display: swap always",
        "Preconnect to fonts.googleapis.com",
        "Subset fonts to used character ranges",
    ],
    "animation_rules": [
        "Only animate: opacity, transform (translate/scale/rotate)",
        "Never animate: width, height, margin, padding (causes repaint)",
        "will-change: transform only on actively animating elements",
        "Always respect prefers-reduced-motion",
        "All animations must have exit states",
    ],
    "code_quality": [
        "TypeScript strict mode enabled",
        "No console.log in production",
        "No any types",
        "All images have alt attributes",
        "All interactive elements have aria labels",
        "No hardcoded secrets — env vars only",
        "Every async operation has error handling",
    ],
}

# ═══════════════════════════════════════════════════════════════
# 6. ANTI-PATTERNS — What ZAIRE will NEVER produce
# ═══════════════════════════════════════════════════════════════

ANTI_PATTERNS = {
    "THE_GENERIC_AI_LOOK": {
        "description": "Purple-to-blue gradient hero, white cards, Inter everywhere, rounded corners",
        "fix": "Commit to one strong aesthetic. Study the client's niche references first.",
    },
    "WALL_OF_FEATURES": {
        "description": "6-column grid of identical equal-sized feature cards",
        "fix": "Bento grid with varied sizes. One hero card (2x2), mixed supporting cards.",
    },
    "MOBILE_AFTERTHOUGHT": {
        "description": "Desktop design squished to mobile with display:none on half the elements",
        "fix": "Mobile-first. Design for 375px first, enhance for desktop.",
    },
    "LOREM_IPSUM": {
        "description": "Placeholder text in any form in final output",
        "fix": "Generate contextual copy based on the project brief. Never use lorem ipsum.",
    },
    "INCONSISTENT_SPACING": {
        "description": "Random spacing values — some 40px, some 120px, no system",
        "fix": "Always use the 8-point grid: 8, 16, 24, 32, 48, 64, 96, 128. Never deviate.",
    },
    "MISSING_STATES": {
        "description": "Buttons with no hover state, inputs with no focus state, empty states not designed",
        "fix": "Every interactive element needs 3 states minimum: default, hover, active.",
    },
    "CONTRAST_FAILURE": {
        "description": "Text on backgrounds with contrast ratio below 4.5:1",
        "fix": "Check every text/background combination. Minimum 4.5:1 for normal, 3:1 for large.",
    },
    "RAW_IMG_TAGS": {
        "description": "Using <img> instead of next/image",
        "fix": "Always next/image in Next.js. Always.",
    },
    "NO_ERROR_HANDLING": {
        "description": "async functions with no try/catch, API calls with no error states",
        "fix": "Every async operation wrapped in try/catch. Every API call has loading + error + success states.",
    },
    "HARDCODED_SECRETS": {
        "description": "API keys, tokens, passwords in source code",
        "fix": "All secrets in .env files. .env in .gitignore. Never in code.",
    },
}

# ═══════════════════════════════════════════════════════════════
# 7. ENGINEER INSTRUCTIONS — How to use this entire file
# ═══════════════════════════════════════════════════════════════

ENGINEER_SYSTEM_PROTOCOL = """
ZAIRE ENGINEER — MANDATORY BUILD PROTOCOL

Before touching any code, follow these steps exactly:

STEP 1 — UNDERSTAND
Read the full mission brief from the initialization matrix.
Extract: project_type, description, target_audience, design_style,
deployment_target, reference_sites, stack_requirements.

STEP 2 — PROFILE SELECTION
Match project_type to WEBSITE_PROFILES[].
If design_style specified, match to DNA_PROFILES[].
If no style specified, select the best DNA for the project type.
State your selection and reason.

STEP 3 — RESEARCH (when reference sites provided)
For each reference site, analyze mentally:
- What layout pattern do they use?
- What is their emotional register?
- What works? What is outdated or wrong?
- What convention can we invert to be original?

STEP 4 — ARCHITECTURE PLAN
Generate a complete file tree before writing any file.
State the exact pages, components, and data flow.
State the exact npm packages to install.
Get confirmation before proceeding.

STEP 5 — STYLE GUIDE FIRST
Write globals.css with all CSS variables.
Write tailwind.config.ts with custom tokens.
These become the law — every component references only these variables.

STEP 6 — BUILD SEQUENCE
1. layout.tsx (root layout, metadata)
2. globals.css (tokens, resets)
3. tailwind.config.ts
4. Components (Navbar → Footer → shared UI)
5. Pages (Home → other pages in priority order)
6. API routes (if needed)
7. Lib/utils files

STEP 7 — QUALITY GATES (check before delivering)
□ All text passes 4.5:1 contrast ratio
□ All images use next/image
□ No console.log or TODO comments
□ Mobile layout works at 375px
□ All interactive elements have hover + focus states
□ Empty states are designed (not blank)
□ All async operations have error handling
□ No hardcoded secrets
□ No lorem ipsum
□ TypeScript has no 'any' types

MANDATORY RULES:
- Never use placeholder content
- Never produce equal-sized feature card grids
- Never skip mobile design
- Never hardcode secrets
- Never use raw <img> tags in Next.js
- Never ignore ANTI_PATTERNS
- Always generate contextual copy for the project
- Always include proper SEO metadata
- Always use the 8-point spacing grid
- The client can not tell ZAIRE built this — it must look human-crafted
"""
