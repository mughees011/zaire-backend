"""
ZAIRE ENGINEER MODE — ULTRA DESIGN INTELLIGENCE LAYER v3.0
============================================================
This is not just a config file. This is a complete design brain.
The Engineer reads this before every project and reasons from it.
Every decision — color, type, space, motion, layout — is grounded here.
"""

# ═══════════════════════════════════════════════════════════════
# 1. AESTHETIC DNA PROFILES — Full specifications per niche
# ═══════════════════════════════════════════════════════════════

AESTHETIC_DNA = {

    "LUXURY_DARK": {
        "use_when": "High-end watches, luxury fashion, premium spirits, exclusive services",
        "mood_words": ["Cinematic", "Restraint", "Power", "Editorial", "Precision", "Silence"],
        "palette": {
            "background":     "#000000",
            "surface":        "#0A0A0A",
            "surface_raised": "#111111",
            "border":         "rgba(255,255,255,0.06)",
            "primary":        "#C9A84C",      # warm gold
            "primary_muted":  "#8B6914",
            "text_primary":   "#F5F5F5",
            "text_secondary":  "rgba(245,245,245,0.5)",
            "text_muted":     "rgba(245,245,245,0.25)",
            "accent":         "#1A1400",
            "glow":           "rgba(201,168,76,0.15)",
        },
        "typography": {
            "display":    "Cormorant Garamond",   # editorial weight, luxury
            "display_weight": "300",
            "interface":  "Montserrat",           # clean, fashion-adjacent
            "interface_weight": "300",
            "mono":       "Space Mono",
            "scale": {
                "hero":      "clamp(56px, 8vw, 120px)",
                "h1":        "clamp(36px, 5vw, 72px)",
                "h2":        "clamp(24px, 3vw, 48px)",
                "h3":        "clamp(16px, 2vw, 24px)",
                "body":      "16px",
                "small":     "13px",
                "micro":     "10px",
                "letter_spacing_hero": "0.15em",
                "letter_spacing_ui":   "0.08em",
                "letter_spacing_caps": "0.2em",
            }
        },
        "spacing": {
            "philosophy": "EXTREME WHITESPACE. Space is the product. Crowding kills luxury.",
            "section_gap":     "160px",
            "component_gap":   "80px",
            "element_gap":     "32px",
            "padding_section": "120px 80px",
            "padding_card":    "48px",
        },
        "animation": {
            "philosophy": "Every movement is intentional. Nothing bounces. Nothing rushes.",
            "duration_micro":    "0.2s",
            "duration_standard": "0.6s",
            "duration_reveal":   "1.2s",
            "easing_standard": "cubic-bezier(0.25, 0, 0, 1)",
            "easing_enter":    "cubic-bezier(0, 0, 0.2, 1)",
            "easing_exit":     "cubic-bezier(0.4, 0, 1, 1)",
            "scroll_reveal":   "fade-up with 40px offset, staggered 0.1s per element",
            "hover_scale":     "1.02 (never more)",
            "page_transition": "opacity fade 0.4s",
        },
        "corners":      "0px (sharp edges only — rounds are mass market)",
        "borders":      "0.5px, always very subtle",
        "shadows":      "Use glow effects not drop shadows. rgba(201,168,76,0.12) spread.",
        "images":       "Always full-bleed. Never with rounded corners. Black & white preferred for editorial.",
        "dont_do": [
            "No gradients (except very subtle dark-to-transparent)",
            "No bright colors",
            "No more than 2 fonts",
            "No card grid with equal-size cards",
            "No centered hero text that's also short",
            "No stock photo people smiling at camera",
            "No rounded corners above 2px",
            "No emoji in headings",
            "No more than 2 CTAs per section",
        ]
    },

    "TECH_FUTURISM": {
        "use_when": "AI products, dev tools, SaaS platforms, cybersecurity, data platforms",
        "mood_words": ["Precise", "Intelligent", "Fast", "Dense", "Alive", "Systematic"],
        "palette": {
            "background":     "#000000",
            "surface":        "#080C10",
            "surface_raised": "#0D1117",
            "border":         "rgba(0,212,255,0.12)",
            "primary":        "#00D4FF",
            "primary_muted":  "rgba(0,212,255,0.4)",
            "text_primary":   "#E6F1FF",
            "text_secondary":  "rgba(230,241,255,0.55)",
            "text_muted":     "rgba(230,241,255,0.25)",
            "accent_green":   "#00FF88",
            "accent_amber":   "#FFAA00",
            "accent_red":     "#FF4040",
            "glow":           "rgba(0,212,255,0.15)",
        },
        "typography": {
            "display":   "Space Grotesk",
            "display_weight": "700",
            "interface": "Inter",
            "interface_weight": "400",
            "mono":      "JetBrains Mono",
            "scale": {
                "hero":      "clamp(40px, 6vw, 80px)",
                "h1":        "clamp(28px, 4vw, 56px)",
                "h2":        "clamp(20px, 2.5vw, 36px)",
                "body":      "15px",
                "small":     "13px",
                "micro":     "11px",
                "letter_spacing_ui": "0.02em",
                "letter_spacing_caps": "0.1em",
            }
        },
        "spacing": {
            "philosophy": "Grid-locked precision. Every element on an 8px grid. Dense but breathable.",
            "section_gap":   "100px",
            "component_gap": "48px",
            "element_gap":   "16px",
            "grid_base":     "8px",
            "padding_section": "80px 60px",
            "padding_card":    "24px",
        },
        "animation": {
            "philosophy": "Fast and immediate. Feedback is instant. Nothing lingers.",
            "duration_micro":    "0.12s",
            "duration_standard": "0.2s",
            "duration_reveal":   "0.4s",
            "easing_standard": "cubic-bezier(0.4, 0, 0.2, 1)",
            "hover_glow":      "box-shadow expand + border brighten",
            "data_update":     "number counter animation",
            "entry_animation": "fade-in + 20px translateY, 0.3s",
        },
        "corners":  "2px (slightly softened, not sharp, not round)",
        "borders":  "1px solid with glow on hover",
        "shadows":  "Glow shadows only. No traditional drop shadows.",
        "special_elements": [
            "Scanline overlay at 2% opacity across entire page",
            "Subtle grid background at 3-4% opacity",
            "Corner bracket accents on cards (CSS only, no SVG)",
            "Animated number counters for stats",
            "Terminal-style text reveals for code sections",
            "Pulsing status dots for live indicators",
        ],
        "dont_do": [
            "No warm colors (yellow, orange, red as primary)",
            "No serif fonts",
            "No traditional card borders (use glow instead)",
            "No centered hero for dashboards",
            "No gradients between two different hues",
        ]
    },

    "MINIMAL_LUXURY": {
        "use_when": "Architecture, premium portfolios, high-fashion brands, art galleries, boutique agencies",
        "mood_words": ["Breathe", "Refined", "Quiet Confidence", "Timeless", "Elevated"],
        "palette": {
            "background":    "#FAFAF8",
            "surface":       "#FFFFFF",
            "border":        "rgba(0,0,0,0.08)",
            "primary":       "#1A1A1A",
            "text_primary":  "#0A0A0A",
            "text_secondary": "rgba(10,10,10,0.5)",
            "text_muted":    "rgba(10,10,10,0.25)",
            "accent":        "#8B0000",   # deep burgundy
        },
        "typography": {
            "display":   "Playfair Display",
            "display_weight": "400",
            "interface": "Syne",
            "interface_weight": "300",
            "mono":      "Fira Code",
            "scale": {
                "hero":      "clamp(64px, 9vw, 140px)",
                "h1":        "clamp(40px, 5vw, 80px)",
                "body":      "17px",
                "line_height_body": "1.9",
                "letter_spacing_display": "0.0em",
                "letter_spacing_ui": "0.12em",
            }
        },
        "spacing": {
            "philosophy": "Maximum breathing room. 'Nothing should feel hurried.'",
            "section_gap":   "200px",
            "component_gap": "120px",
            "element_gap":   "48px",
            "padding_section": "160px 100px",
        },
        "animation": {
            "philosophy": "Deliberate. Slow reveals that feel cinematic, not sluggish.",
            "duration_standard": "0.8s",
            "duration_reveal":   "1.4s",
            "easing":  "cubic-bezier(0.16, 1, 0.3, 1)",
            "scroll_reveal": "opacity 0 to 1 only. No translate. Pure fade.",
        },
        "corners":  "0px (absolutely sharp)",
        "borders":  "1px solid, light — or no border at all",
        "images":   "Full-bleed, black & white or highly desaturated, always aspect-ratio locked",
    },

    "STARTUP_MODERN": {
        "use_when": "SaaS products, mobile apps, consumer tech, productivity tools",
        "mood_words": ["Friendly", "Confident", "Clear", "Energetic", "Accessible"],
        "palette": {
            "background":    "#FFFFFF",
            "surface":       "#F8FAFC",
            "primary":       "#6366F1",   # indigo
            "primary_dark":  "#4F46E5",
            "text_primary":  "#0F172A",
            "text_secondary": "#64748B",
            "accent":        "#F59E0B",
        },
        "typography": {
            "display":   "Cal Sans",       # or Geist
            "interface": "Inter",
            "mono":      "Geist Mono",
            "scale": {
                "hero": "clamp(40px, 5vw, 72px)",
                "h1":   "clamp(28px, 3vw, 48px)",
                "body": "16px",
                "line_height": "1.7",
            }
        },
        "spacing": {
            "philosophy": "Comfortable but efficient. Not wasteful, not cramped.",
            "section_gap":   "96px",
            "component_gap": "48px",
            "padding_card":  "32px",
        },
        "animation": {
            "duration_standard": "0.3s",
            "easing":  "cubic-bezier(0.34, 1.56, 0.64, 1)",  # slight spring
            "hover_scale": "1.03",
        },
        "corners":  "12px (friendly rounded)",
        "borders":  "1px solid rgba(0,0,0,0.08)",
        "shadows":  "Multi-layer soft shadows: 0 1px 3px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)",
    },

    "BRAND_SIGNATURE": {
        "use_when": "Brand projects — watches, menswear, luxury e-commerce",
        "mood_words": ["Dark Authority", "Editorial Precision", "Watch Culture", "Minimal Arrogance"],
        "palette": {
            "background":    "#000000",
            "surface":       "#080808",
            "primary":       "#C9A84C",    # Brand gold
            "primary_light": "#E8C96A",
            "text_primary":  "#FFFFFF",
            "text_secondary": "rgba(255,255,255,0.5)",
            "sapphire":      "#0047AB",    # sapphire crystal reference
        },
        "typography": {
            "display":   "Cormorant Garamond",
            "interface": "Montserrat",
            "mono":      "Space Mono",
            "hero_size": "clamp(48px, 7vw, 100px)",
            "hero_weight": "300",
            "letter_spacing_hero": "0.2em",
        },
        "reference_sites": [
            "rolex.com — full-bleed photography, minimal nav, product-first",
            "audemarspiguet.com — dark editorial, video backgrounds",
            "patek.com — conservative luxury, typography-led",
            "mrporter.com — editorial fashion e-commerce grid",
        ]
    }
}


# ═══════════════════════════════════════════════════════════════
# 2. LAYOUT ARCHETYPES — Full structural blueprints
# ═══════════════════════════════════════════════════════════════

LAYOUT_ARCHETYPES = {

    "CINEMATIC_HERO": {
        "use_when": "First impression matters above all else. Luxury, brand launches.",
        "structure": """
            [FULL VIEWPORT HEIGHT]
            Background: Full-bleed video or high-res image
            Overlay: Dark gradient (bottom-heavy)
            Content: Bottom-left anchored text (never centered for luxury)
            Nav: Transparent, top-right
            CTA: Below headline, no button border on dark — just text + arrow
            Scroll indicator: Thin vertical line + 'scroll' text
        """,
        "avoid": "Centered text, hero buttons that look like generic CTAs",
        "reference_pattern": "Aston Martin, Rimowa, Bang & Olufsen"
    },

    "EDITORIAL_SPLIT": {
        "use_when": "Portfolio, agency, storytelling brands",
        "structure": """
            [VIEWPORT HEIGHT]
            Left 55%: Large typography, vertically centered
            Right 45%: Full-height image, no margin
            Nav: Overlaid on left panel, minimal
            Color split: Dark left, image right (or full white)
        """,
        "avoid": "Equal split, both sides the same weight",
    },

    "BENTO_GRID": {
        "use_when": "SaaS features, portfolios showing multiple capabilities, dashboards",
        "structure": """
            [ASYMMETRIC GRID — never uniform sizes]
            Large card (2x2): Hero feature or primary showcase
            Medium card (2x1): Secondary features
            Small card (1x1): Stats, integrations, quick wins
            Rule: At least one card must be full-width
            Rule: Mix dark and light cards for visual rhythm
        """,
        "avoid": "All cards same size, all cards same color, more than 6 cards",
        "animation": "Cards stagger-reveal on scroll, 0.08s delay per card"
    },

    "VERTICAL_NARRATIVE": {
        "use_when": "Product storytelling, luxury e-commerce, brand manifesto pages",
        "structure": """
            Section 1: Full-bleed hero
            Section 2: Product close-up + single line of copy (opposite sides)
            Section 3: Feature detail — image left, copy right
            Section 4: Feature detail — copy left, image right (alternating)
            Section 5: Materials / Craftsmanship — horizontal scroll gallery
            Section 6: Social proof — editorial quote, large typography
            Section 7: CTA — product + price + add to cart, full width
        """,
        "spacing_rule": "Each section gets its own breathing room — 160px gaps minimum"
    },

    "DASHBOARD_COCKPIT": {
        "use_when": "Data products, monitoring tools, admin panels, analytics",
        "structure": """
            Persistent left sidebar: 240px, dark, hierarchical nav
            Top bar: Breadcrumb + global search + user avatar
            Main area: Widget grid (8-column base)
            Right panel (optional): Context panel, 280px
            Status bar: Bottom, persistent system status
        """,
        "component_rules": [
            "Every metric needs a sparkline or trend indicator",
            "Status always shown with colored dot, not just text",
            "Empty states must be designed — never blank",
            "Tables always have zebra striping at 2% opacity",
        ]
    },

    "IMMERSIVE_SCROLL": {
        "use_when": "Award-winning portfolios, interactive brand experiences",
        "structure": """
            Lenis smooth scroll (always)
            GSAP ScrollTrigger sections that pin and animate
            Each section is full-viewport
            Elements animate into position as you scroll
            Horizontal scroll section for gallery/showcase
            Custom cursor (dot + text that changes per section)
        """,
        "tech_required": ["GSAP", "Lenis", "@studio-freight/lenis", "Three.js optional"]
    }
}


# ═══════════════════════════════════════════════════════════════
# 3. COMPONENT LIBRARY — Reusable design patterns
# ═══════════════════════════════════════════════════════════════

COMPONENT_PATTERNS = {

    "NAVIGATION": {
        "LUXURY_FLOATING": {
            "style": "Fixed, full-width, transparent on hero, fills on scroll",
            "height": "72px",
            "logo_position": "left",
            "links_position": "center",
            "cta_position": "right",
            "scroll_behavior": "adds backdrop-blur(20px) + border-bottom at 100px scroll",
            "mobile": "Hamburger → full-screen overlay with large typography links"
        },
        "TECH_MINIMAL": {
            "style": "Sticky, border-bottom, glassmorphism always",
            "height": "52px",
            "logo_position": "left",
            "links_position": "center",
            "cta_position": "right",
            "mobile": "Bottom tab bar (native app feel)"
        },
        "SIDEBAR_PERSISTENT": {
            "style": "Fixed left sidebar, 240px, icon + text, collapsible to 64px",
            "sections": "Main nav → divider → secondary nav → divider → user section",
            "active_state": "Left border accent + background highlight",
            "hover_state": "Background at 6% opacity"
        }
    },

    "BUTTONS": {
        "LUXURY_PRIMARY": {
            "style": "No background, border 1px solid gold, text in caps, letter-spacing 0.15em",
            "padding": "14px 40px",
            "hover": "Background fills to gold, text goes black",
            "transition": "0.4s all ease",
            "never_use": "Border-radius above 2px for luxury"
        },
        "TECH_PRIMARY": {
            "style": "Solid background primary color, 0-2px radius",
            "hover": "Brightness 1.1 + subtle glow",
            "focus": "Outline with offset, never box-shadow"
        },
        "GHOST": {
            "style": "Border only, no fill",
            "hover": "Fill at 8% opacity of border color"
        },
        "TEXT_ARROW": {
            "style": "Text + → icon, no border, no background",
            "hover": "Arrow translates +4px right",
            "use_for": "Secondary actions, 'learn more' links"
        },
        "ANGULAR_HUD": {
            "style": "clip-path polygon corners, cyan glow border, dark fill",
            "use_for": "ZAIRE/tech dashboard CTAs only",
            "padding": "12px 28px",
            "hover": "Glow intensifies, shimmer sweep animation"
        }
    },

    "CARDS": {
        "LUXURY_PRODUCT": {
            "style": "No border, no shadow — just the image and minimal text below",
            "image": "Full aspect ratio preserved, hover: scale(1.03) on image only",
            "text": "Product name in display font, price in interface font",
            "spacing": "48px between cards minimum",
            "hover_effect": "Image zoom (overflow hidden on container), text stays still"
        },
        "GLASS_CARD": {
            "style": "backdrop-filter: blur(12px), semi-transparent background, subtle border",
            "background": "rgba(255,255,255,0.05) on dark / rgba(0,0,0,0.04) on light",
            "border": "1px solid rgba(255,255,255,0.1)",
            "use_for": "Tech/futurism dashboards, feature showcases"
        },
        "BENTO_CARD": {
            "style": "Dark background, corner brackets, subtle glow on hover",
            "hover": "border-color increases opacity, top line glow appears",
            "corner_accent": "CSS ::before/::after, 10px lines, mode primary color"
        },
        "EDITORIAL_CARD": {
            "style": "Full-bleed image top, text below, no box styling",
            "image_ratio": "4:3 or 16:9, consistent across all cards in grid",
            "text_padding": "24px 0",
            "category": "Small caps, letter-spacing, above title"
        }
    },

    "TYPOGRAPHY_PATTERNS": {
        "LUXURY_HERO": {
            "structure": [
                "Eyebrow: 10px, letter-spacing 0.3em, uppercase, muted color",
                "Headline: Display font, ultra-large, light weight (300)",
                "Subheadline: Interface font, medium size, muted",
                "CTA: Separated by 48px from subheadline"
            ]
        },
        "TECH_HERO": {
            "structure": [
                "Badge: Pill shape, primary color, small text — 'New' or status",
                "Headline: Bold, gradient text or solid, max 6 words",
                "Description: 2-3 lines max, secondary color, 16-18px",
                "CTAs: Primary + Ghost side by side",
                "Social proof: Avatars + star rating below CTAs"
            ]
        },
        "SECTION_HEADER": {
            "structure": [
                "Eyebrow label with line: small, caps, accent color",
                "Section title: 2-3 lines max",
                "Supporting text: Max 2 sentences",
                "Align: Left for most sections (not centered unless specifically editorial)"
            ]
        }
    },

    "MICRO_INTERACTIONS": {
        "HOVER_GLOW": "box-shadow: 0 0 20px rgba(primary, 0.3) on hover, 0.2s transition",
        "BUTTON_RIPPLE": "::after pseudo element, scale from 0 to 2, opacity 0 on click",
        "LINK_UNDERLINE": "scaleX from 0 to 1 on hover, transform-origin: left",
        "CARD_LIFT": "translateY(-4px) + shadow increase on hover",
        "INPUT_FOCUS": "border-color → primary, subtle glow, label floats up",
        "COUNTER_ANIMATE": "Count up from 0 on scroll into view, 1.5s duration",
        "IMAGE_REVEAL": "clip-path wipe left-to-right on scroll enter",
        "TEXT_SCRAMBLE": "Characters randomize then resolve to final text (for tech aesthetic)",
        "CURSOR_CUSTOM": "Dot cursor + optional text label that changes per element hovered",
    }
}


# ═══════════════════════════════════════════════════════════════
# 4. INSPIRATION SCRAPING TARGETS — Per niche reference sites
# ═══════════════════════════════════════════════════════════════

INSPIRATION_SOURCES = {
    "LUXURY_WATCHES": [
        {"url": "rolex.com",         "study": "Full-bleed photography, minimal copy, product confidence"},
        {"url": "audemarspiguet.com", "study": "Dark editorial, movement detail macro shots"},
        {"url": "patek.com",          "study": "Conservative but refined, heritage typography"},
        {"url": "iwc.com",            "study": "Story-driven scrolling, technical detail"},
        {"url": "richardmille.com",   "study": "Extreme luxury, technical jargon as design element"},
    ],
    "LUXURY_FASHION": [
        {"url": "celine.com",     "study": "Pure minimalism, photography-first"},
        {"url": "bottegaveneta.com", "study": "Dark, craftsmanship focus"},
        {"url": "loewe.com",      "study": "Artistic, unconventional layouts"},
        {"url": "mrporter.com",   "study": "Editorial e-commerce, content-driven"},
    ],
    "AI_TECH_PRODUCTS": [
        {"url": "linear.app",      "study": "Dark, fast, developer-focused, bento grid features"},
        {"url": "vercel.com",      "study": "Black background, gradient text, feature density"},
        {"url": "cursor.com",      "study": "Dark minimal, single-focus messaging"},
        {"url": "stripe.com",      "study": "Light mode mastery, diagram-heavy, trust signals"},
        {"url": "raycast.com",     "study": "Dark gradient, product demo centered, community"},
    ],
    "AWARD_WINNING_PORTFOLIOS": [
        {"url": "bruno-simon.com",    "study": "3D interactive, playful tech"},
        {"url": "robbowen.digital",   "study": "Dark, motion, experimental typography"},
        {"url": "tympanus.net",       "study": "Codepen experiments, cutting-edge CSS"},
        {"url": "awwwards.com",       "study": "Daily winners for current design trends"},
    ],
    "SAAS_BEST_IN_CLASS": [
        {"url": "notion.so",    "study": "Clean, document-first, feature-rich without clutter"},
        {"url": "figma.com",    "study": "Purple brand, community-first, feature showcase"},
        {"url": "loom.com",     "study": "Warm, friendly, video-forward"},
        {"url": "retool.com",   "study": "Power-user density, technical trust"},
    ]
}


# ═══════════════════════════════════════════════════════════════
# 5. DESIGN BRIEF TEMPLATE — What Engineer generates before building
# ═══════════════════════════════════════════════════════════════

DESIGN_BRIEF_TEMPLATE = """
PROJECT: {project_name}
NICHE: {niche}
TARGET USER: {target_user}
DNA PROFILE: {selected_dna}
MOOD BOARD: {mood_words}

RESEARCH INSIGHTS:
{competitor_analysis}

DIFFERENTIATION STRATEGY:
{what_we_do_differently}

STYLE GUIDE:
- Background: {bg_color}
- Surface: {surface_color}
- Primary: {primary_color}
- Display Font: {display_font}
- Interface Font: {interface_font}
- Border Radius: {border_radius}
- Animation Easing: {easing}
- Animation Duration: {duration}
- Section Padding: {section_padding}
- Letter Spacing (caps): {letter_spacing}

LAYOUT ARCHETYPE: {layout_archetype}

PAGE STRUCTURE:
{page_sections}

COMPONENT DECISIONS:
- Navigation type: {nav_type}
- Hero type: {hero_type}
- Card style: {card_style}
- Button style: {button_style}

WHAT WE ARE NOT DOING:
{dont_list}

UNIQUE DESIGN DECISIONS:
{unique_choices}
"""


# ═══════════════════════════════════════════════════════════════
# 6. ANTI-PATTERNS — What to never do (with reasons)
# ═══════════════════════════════════════════════════════════════

DESIGN_ANTI_PATTERNS = {

    "THE_GENERIC_AI_LOOK": {
        "description": "Gradient purple-to-blue hero, white cards, Inter font, rounded corners everywhere",
        "why_bad": "Every AI startup looks like this. Instant signal of low design effort.",
        "fix": "Commit to one strong aesthetic. Dark or light, not gradient middle-ground."
    },
    "WALL_OF_FEATURES": {
        "description": "6-column grid of identical feature cards all the same size",
        "why_bad": "No visual hierarchy. Eyes don't know where to go. Everything feels equal = nothing feels important.",
        "fix": "Bento grid with varied sizes. Lead with 1-2 hero features, support with smaller cards."
    },
    "FAKE_URGENCY_BUTTONS": {
        "description": "Large, bright, rounded 'GET STARTED FREE' buttons on every section",
        "why_bad": "Feels desperate. Luxury and premium products don't beg.",
        "fix": "One primary CTA per page. Make it confident, not loud."
    },
    "LOREM_IPSUM_SPACING": {
        "description": "Inconsistent spacing — some sections 40px apart, others 120px",
        "why_bad": "Signals lack of systematic thinking. Users feel discomfort even if they can't explain why.",
        "fix": "Define a spacing scale (8, 16, 24, 32, 48, 64, 96, 128) and never deviate."
    },
    "MIXED_METAPHORS": {
        "description": "Some components look dark tech, some look friendly startup, some look corporate",
        "why_bad": "Brand confusion. User can't form a mental model of who you are.",
        "fix": "Pick one DNA profile. Apply it with religious consistency."
    },
    "MOBILE_AFTERTHOUGHT": {
        "description": "Desktop layout squished to mobile with display:none on half the elements",
        "why_bad": "60-70% of users are on mobile. This is not optional.",
        "fix": "Design mobile-first. Desktop is the enhancement."
    },
    "ACCESSIBILITY_IGNORED": {
        "description": "4.2:1 contrast ratio, no focus states, 11px text on gray background",
        "why_bad": "Legal risk + poor UX + bad SEO. All preventable.",
        "fix": "Minimum 4.5:1 contrast. All interactive elements have visible focus. Min 14px body text."
    }
}


# ═══════════════════════════════════════════════════════════════
# 7. TECH STACK DECISION TREE — What to use and when
# ═══════════════════════════════════════════════════════════════

TECH_STACK_DECISIONS = {

    "NEEDS_3D_OR_IMMERSIVE": {
        "condition": "Client asks for 3D, particles, animated blob, WebGL",
        "stack": ["Three.js", "React Three Fiber", "@react-three/drei", "GSAP"],
        "warning": "3D adds significant bundle size. Only use if essential to brand."
    },
    "NEEDS_COMPLEX_ANIMATIONS": {
        "condition": "Scroll-triggered animations, page transitions, complex motion",
        "stack": ["GSAP + ScrollTrigger", "Framer Motion", "Lenis (smooth scroll)"],
        "note": "Framer Motion for component animations, GSAP for scroll sequences"
    },
    "NEEDS_ECOMMERCE": {
        "condition": "Product catalog, cart, checkout, payments",
        "stack": ["Next.js 14", "Stripe", "Prisma + PostgreSQL", "Cloudinary (images)"],
        "optional": ["Shopify Storefront API if large inventory"]
    },
    "NEEDS_CONTENT_MANAGEMENT": {
        "condition": "Blog, editorial content, non-developer updates needed",
        "stack": ["Next.js 14", "Sanity.io or Contentful", "Portable Text"],
        "note": "Sanity is better for custom schemas. Contentful for enterprise."
    },
    "NEEDS_AUTH": {
        "condition": "User accounts, protected routes, roles",
        "stack": ["NextAuth.js v5 or Clerk"],
        "note": "Clerk is faster to implement. NextAuth more flexible long-term."
    },
    "SIMPLE_LANDING_PAGE": {
        "condition": "Marketing page, no dynamic data, fast delivery needed",
        "stack": ["Next.js 14 static", "Tailwind CSS", "Framer Motion (minimal)"],
        "deploy": "Vercel — zero config, instant"
    },
    "DASHBOARD_APP": {
        "condition": "Data-heavy, real-time updates, complex state",
        "stack": ["Next.js 14", "Zustand", "TanStack Query", "Recharts or D3"],
        "note": "TanStack Query for all server state. Zustand for UI state only."
    }
}


# ═══════════════════════════════════════════════════════════════
# 8. ORIGINALITY FRAMEWORK — How to design something NEW
# ═══════════════════════════════════════════════════════════════

ORIGINALITY_FRAMEWORK = {

    "STEP_1_DECONSTRUCT": """
    Before designing, deconstruct 3 reference sites:
    - What is their layout pattern? (hero type, grid system, nav position)
    - What is their emotional register? (what do you FEEL when you see it)
    - What do they do that works? (extract the principle, not the execution)
    - What do they do that doesn't work or feels dated?
    """,

    "STEP_2_INVERT": """
    Take one convention in this niche and flip it:
    - Everyone uses white backgrounds? Go dark.
    - Everyone uses centered hero text? Go left-aligned.
    - Everyone uses card grids? Use a vertical narrative.
    - Everyone uses color gradients? Use pure monochrome.
    The inversion must be justified by the brand strategy, not arbitrary.
    """,

    "STEP_3_COMBINE": """
    Take aesthetic elements from two different, unexpected niches:
    - Architecture firm + tech dashboard = premium SaaS
    - Fashion editorial + developer tool = Raycast
    The combination creates something that feels familiar but fresh.
    """,

    "STEP_4_SIGNATURE_ELEMENT": """
    Every great design has one memorable signature element:
    - Linear.app: the spotlight effect on dark background
    - Stripe: the gradient mesh hero
    - Apple: the product floating on pure white
    - Rolex: the oyster case in water
    Design ONE element that will be this project's signature.
    This is what people screenshot and share.
    """,

    "STEP_5_CONSTRAINT": """
    Impose one creative constraint and design within it:
    - "Only use 2 colors"
    - "No images, typography only"
    - "Every section must have one very large number"
    - "Navigation must be invisible until needed"
    Constraints force creativity. Freedom produces generic results.
    """
}


# ═══════════════════════════════════════════════════════════════
# 9. RESPONSIVE DESIGN SYSTEM
# ═══════════════════════════════════════════════════════════════

RESPONSIVE_SYSTEM = {
    "BREAKPOINTS": {
        "mobile":  "< 640px",
        "tablet":  "640px - 1024px",
        "desktop": "1024px - 1440px",
        "wide":    "> 1440px"
    },
    "MOBILE_FIRST_RULES": [
        "Design the mobile layout first, always",
        "Touch targets minimum 44x44px",
        "Navigation collapses to hamburger or bottom bar",
        "Font sizes use clamp() — never fixed px that break on mobile",
        "Images use aspect-ratio: to prevent layout shift",
        "No hover-only interactions — all must work on touch",
        "Horizontal scroll sections become vertical stacks on mobile",
        "Grid columns: mobile 1, tablet 2, desktop 3-4",
    ],
    "CONTAINER_SIZES": {
        "max_width_content": "1200px",
        "max_width_text":    "720px",
        "max_width_narrow":  "560px",
        "padding_mobile":    "20px",
        "padding_tablet":    "40px",
        "padding_desktop":   "80px",
    }
}


# ═══════════════════════════════════════════════════════════════
# 10. PERFORMANCE RULES — Beautiful AND fast
# ═══════════════════════════════════════════════════════════════

PERFORMANCE_RULES = {
    "IMAGES": [
        "Always use Next.js <Image> component",
        "WebP format only (never JPG/PNG if avoidable)",
        "Lazy load everything below the fold",
        "Hero image: preload with priority={true}",
        "Always specify width and height to prevent CLS",
        "Use blur placeholder for loading state",
    ],
    "FONTS": [
        "Maximum 2 font families per project",
        "Use variable fonts where available",
        "Subset fonts to used characters only",
        "font-display: swap always",
        "Preconnect to fonts.googleapis.com",
    ],
    "ANIMATIONS": [
        "Only animate: opacity, transform (translate, scale, rotate)",
        "Never animate: width, height, margin, padding, color (causes repaints)",
        "Use will-change: transform sparingly (only on elements that definitely animate)",
        "Respect prefers-reduced-motion media query always",
    ],
    "TARGET_SCORES": {
        "LCP": "< 2.5s",
        "FID": "< 100ms",
        "CLS": "< 0.1",
        "Lighthouse_Performance": "> 90",
        "Lighthouse_Accessibility": "> 95",
    }
}


# ═══════════════════════════════════════════════════════════════
# ENGINEER INSTRUCTION — How to use this file
# ═══════════════════════════════════════════════════════════════

ENGINEER_INSTRUCTIONS = """
Before every build, follow this sequence:

1. IDENTIFY: What niche is this project in? Match to AESTHETIC_DNA.

2. RESEARCH: Use INSPIRATION_SOURCES to find 3 relevant reference sites.
   Visit them with the browser tool. Screenshot and analyze.
   Extract: layout pattern, emotional register, what works, what doesn't.

3. BRIEF: Generate a complete Design Brief using DESIGN_BRIEF_TEMPLATE.
   Present it to Mughees. Get approval before writing any code.

4. DIFFERENTIATE: Apply ORIGINALITY_FRAMEWORK.
   What is the one convention we are inverting?
   What is the signature element of this design?

5. BUILD: Follow the approved brief religiously.
   Every decision must reference the brief.
   If a decision isn't in the brief, add it before implementing.
   
   SECTION DESIGN PROTOCOL (MANDATORY):
   Before writing code for each section, state:
   SECTION: [name]
   PURPOSE: What does this section need the user to FEEL or DO?
   HIERARCHY: What is the #1 most important element here?
   LAYOUT: Describe the layout in words before implementing it
   ANIMATION: What animates, when, and how?
   MOBILE: How does this section change on mobile?
   COPYWRITING: Is the text concise enough? (Default: cut 30% of words)
   DECISION: What one design choice makes this section non-generic?

6. AUDIT: After building, check against DESIGN_ANTI_PATTERNS.
   Check PERFORMANCE_RULES.
   Fix before delivering.

NEVER:
- Start coding before the Design Brief is approved
- Use a layout pattern just because it's familiar
- Mix aesthetic DNA profiles (pick ONE and commit)
- Skip the mobile layout
- Leave empty states undesigned

ALWAYS:
- Present the Style Guide JSON before building
- Justify every major design decision in plain English
- Ask "does this feel like the brand?" at every step
- Remember: Mughees builds premium products. Generic is failure.
"""

# ═══════════════════════════════════════════════════════════════
# 11. THE DESIGN REASONING ENGINE — Senior Designer Logic
# ═══════════════════════════════════════════════════════════════

DESIGN_REASONING = {

    "FONT_PAIRING_SCIENCE": {
        "rule": "Never pair two fonts of the same category",
        "categories": {
            "Serif": ["Cormorant Garamond", "Playfair Display", 
                      "EB Garamond", "Lora", "Libre Baskerville"],
            "Geometric Sans": ["Montserrat", "Futura", "Circular", 
                               "Nunito", "Poppins"],
            "Humanist Sans": ["Inter", "Gill Sans", "Frutiger", 
                              "Trebuchet", "Myriad"],
            "Grotesque": ["Space Grotesk", "Helvetica", "Aktiv Grotesk",
                          "Neue Haas", "DM Sans"],
            "Slab Serif": ["Roboto Slab", "Zilla Slab", "Arvo"],
            "Display": ["Orbitron", "Bebas Neue", "Anton", "Black Han Sans"],
            "Monospace": ["JetBrains Mono", "Space Mono", "Fira Code",
                          "Geist Mono", "IBM Plex Mono"]
        },
        "proven_pairings": {
            "Cormorant Garamond + Montserrat": {
                "why": "High-contrast editorial serif meets geometric clean sans. "
                       "Creates tension between heritage and modernity.",
                "use_for": "Luxury brands, fashion, watches, premium e-commerce"
            },
            "Playfair Display + Source Sans Pro": {
                "why": "Classic editorial combination. Playfair is expressive at "
                       "large sizes, Source Sans is invisible at body size (good).",
                "use_for": "Magazines, editorial, journalism, high-end blogs"
            },
            "Space Grotesk + Inter": {
                "why": "Both are modern but Space Grotesk has enough personality "
                       "at display sizes to differentiate from Inter's neutrality.",
                "use_for": "Tech startups, SaaS, developer tools, AI products"
            },
            "Orbitron + Share Tech Mono": {
                "why": "Both are futuristic but serve different functions. "
                       "Orbitron is decorative/identity, Share Tech Mono is functional.",
                "use_for": "ZAIRE-style HUDs, dashboards, sci-fi interfaces"
            },
            "Bebas Neue + Inter": {
                "why": "Maximum contrast between display and body. "
                       "Bebas is loud, Inter is invisible — perfect hierarchy.",
                "use_for": "Bold brand statements, sports, streetwear, impact-first"
            },
            "Syne + Outfit": {
                "why": "Both are contemporary but Syne has a distinctive geometry "
                       "that Outfit's friendliness balances.",
                "use_for": "Creative agencies, portfolios, design studios"
            }
        },
        "weight_pairing_rules": [
            "Hero headline: 300 (thin) on dark backgrounds — elegance",
            "Hero headline: 700-900 on light backgrounds — impact",
            "Body text: 400 always — never use 300 for body, too light",
            "UI labels: 500 (medium) — readable but not heavy",
            "Captions/micro: 400, never bold — context not emphasis",
            "Never use more than 3 weights from the same font family per page"
        ]
    },

    "COLOR_PSYCHOLOGY_DEEP": {
        "BLACK_VARIATIONS": {
            "#000000": "Absolute power. Uncompromising. Used by Apple. "
                       "Can feel cold if not warmed with texture or typography.",
            "#0A0A0A": "Soft black. More approachable. Less harsh on screens. "
                       "Preferred for long-form dark mode reading.",
            "#000814": "Navy-tinted black. Communicates intelligence and depth. "
                       "Tech and finance. ZAIRE primary background.",
            "#0D0D0D": "Neutral dark. The safest dark background. "
                       "Works with almost any accent color.",
            "#1A1A1A": "Dark grey. More human, less austere than true black. "
                       "Good for brands that want premium but approachable.",
            "#000B1E": "Deep navy. Heritage, trust, authority. "
                       "Investment banking aesthetic."
        },
        "GOLD_VARIATIONS": {
            "#FFD700": "Cheap gold. Avoid. Feels like a discount sale badge.",
            "#C9A84C": "Warm antique gold. Genuine luxury. Brand signature.",
            "#D4AF37": "Classic gold. Heritage luxury. Watches, jewelry.",
            "#B8960C": "Deep gold. More serious, less decorative.",
            "#E8C96A": "Light gold. Accent only. Never as primary.",
            "rule": "Gold must never be used on white. Only on very dark backgrounds."
        },
        "CYAN_BLUE_VARIATIONS": {
            "#00D4FF": "Electric cyan. Tech, AI, futurism. ZAIRE primary.",
            "#00F2FF": "Bright cyan. More neon, more aggressive. Use sparingly.",
            "#0084FF": "Pure blue. Trust, reliability, corporate tech.",
            "#3B82F6": "Tailwind blue-500. Startup standard. Friendly tech.",
            "#6366F1": "Indigo. Creative tech, AI with personality. Linear-style.",
            "rule": "Never use two blues on the same page as primary and secondary."
        },
        "CONTRAST_REQUIREMENTS": {
            "WCAG_AA_normal_text":  "4.5:1 minimum",
            "WCAG_AA_large_text":   "3.0:1 minimum (18px+ or 14px+ bold)",
            "WCAG_AAA_normal_text": "7.0:1 for highest accessibility",
            "check_tool": "Use this formula: never put rgba(255,255,255,0.4) "
                          "on #000000 — that's only 3.2:1, fails AA",
            "safe_combinations": {
                "#00D4FF on #000000":          "12.6:1 — excellent",
                "rgba(255,255,255,0.7) on #000000": "10.8:1 — good",
                "rgba(255,255,255,0.5) on #000000": "6.0:1 — passes AA",
                "rgba(255,255,255,0.4) on #000000": "3.2:1 — FAILS AA",
                "#C9A84C on #000000":          "7.8:1 — excellent",
            }
        }
    },

    "GRID_SYSTEM_MASTERY": {
        "8_POINT_GRID": {
            "rule": "Every spacing value must be divisible by 8",
            "values": [8, 16, 24, 32, 40, 48, 64, 80, 96, 128, 160, 200],
            "why": "Creates subconscious visual harmony. Users feel it even "
                   "if they can't name it. Inconsistent spacing feels 'off'.",
            "exceptions": "Only exception: 4px for very tight micro-spacing "
                          "(icon padding, badge padding)"
        },
        "12_COLUMN_GRID": {
            "rule": "Always design on a 12-column grid",
            "common_layouts": {
                "full_width":      "12/12 — hero images, full-bleed sections",
                "two_thirds":      "8/12 — primary content column",
                "half":            "6/12 — two-column layouts",
                "one_third":       "4/12 — sidebar, feature cards in 3-column",
                "one_quarter":     "3/12 — four-column card grids",
                "offset_layout":   "Start col 2, width 10/12 — creates luxury margin"
            }
        },
        "GOLDEN_RATIO": {
            "value": "1.618",
            "applications": [
                "Split-screen: 61.8% / 38.2% (not 50/50)",
                "Card image ratio: height = width × 1.618",
                "Type scale: multiply each size by 1.618",
                "Section proportion: content height × 1.618 = section height"
            ]
        },
        "RULE_OF_THIRDS": {
            "application": "Place the most important element at an intersection "
                           "of the thirds grid (not center, not corner)",
            "for_hero": "Headline starts at 1/3 from top, "
                        "not vertically centered"
        }
    },

    "VISUAL_HIERARCHY_LAWS": {
        "LAW_1_SIZE": "Bigger = more important. Never break this.",
        "LAW_2_COLOR": "Saturated/bright = important. Muted = secondary.",
        "LAW_3_CONTRAST": "High contrast = foreground. Low contrast = background.",
        "LAW_4_POSITION": "Top-left = first read (F-pattern). "
                          "Bottom-right = last read.",
        "LAW_5_SPACE": "Surrounded by space = important. "
                       "Crowded = secondary information.",
        "LAW_6_WEIGHT": "Bold = important. Light = secondary.",
        "COMMON_VIOLATIONS": [
            "CTA button same size as body text — fix: make CTA larger",
            "Equal visual weight on headline and subheadline — "
            "fix: subheadline must be at least 40% smaller",
            "Navigation items same weight as brand name — "
            "fix: brand name must be heavier or more distinctive",
            "Three elements competing at same level — "
            "fix: ruthlessly decide one winner per section"
        ]
    },

    "WHITESPACE_PHILOSOPHY": {
        "ACTIVE_WHITESPACE": "Intentional space that creates relationship "
                             "between elements. Not empty, but purposeful.",
        "PASSIVE_WHITESPACE": "Space at page margins and between sections. "
                              "Gives the design room to breathe.",
        "LUXURY_RULE": "When in doubt, add more space. Then add more.",
        "DENSITY_RULE": "Dashboards and data products CAN be dense. "
                        "Brand and marketing cannot.",
        "MICRO_WHITESPACE": "Space between lines (line-height) and letters "
                            "(letter-spacing) matters as much as macro spacing.",
        "OPTIMAL_LINE_HEIGHT": {
            "display_text": "1.1 - 1.2 (tighter for large headings)",
            "body_text":    "1.6 - 1.8 (comfortable for reading)",
            "UI_labels":    "1.2 - 1.4 (compact but clear)"
        },
        "OPTIMAL_LINE_LENGTH": {
            "rule": "45-75 characters per line for body text",
            "too_wide": "Makes eyes tired tracking from end to start",
            "too_narrow": "Too many line breaks interrupt flow",
            "css_implementation": "max-width: 65ch on body text containers"
        }
    },

    "HERO_SECTION_FORMULAS": {
        "LUXURY_PRODUCT_HERO": {
            "formula": [
                "Full viewport height",
                "Product photography as background (not illustration)",
                "Text bottom-left aligned (never centered for true luxury)",
                "Maximum 6 words in headline",
                "Headline in display font, very large, very thin weight",
                "Single CTA: text link with arrow, no button border",
                "Scroll indicator bottom-center"
            ],
            "copywriting_rule": "Never describe the product. Describe the feeling.",
            "examples": {
                "bad":  "The New Royal Oak Watch Collection 2024",
                "good": "Time, Mastered."
            }
        },
        "TECH_PRODUCT_HERO": {
            "formula": [
                "Viewport height or slightly less (show top of next section)",
                "Centered text — acceptable for tech/SaaS",
                "Badge: 'New' or product version pill at very top",
                "Headline: Bold, max 8 words, gradient text acceptable",
                "Subheading: 2-3 lines, explains the value clearly",
                "2 CTAs: primary solid + secondary ghost",
                "Below fold: product screenshot/mockup or demo"
            ],
            "copywriting_rule": "Lead with the outcome, not the feature.",
            "examples": {
                "bad":  "An AI-powered task management system with integrations",
                "good": "Ship 3x faster. Your AI project manager."
            }
        },
        "EDITORIAL_HERO": {
            "formula": [
                "Full height",
                "Large typographic statement — the design IS the typography",
                "Minimal or no images",
                "Unexpected layout (text rotated, oversized, split across sections)",
                "One accent color element only"
            ]
        }
    },

    "ANIMATION_CHOREOGRAPHY": {
        "STAGGER_RULE": "Never animate all elements at once. Stagger by 0.08-0.12s.",
        "ENTRY_HIERARCHY": [
            "1st: Page background/hero image (instant)",
            "2nd: Navigation (0.1s delay)",
            "3rd: Headline (0.2s delay)",
            "4th: Subheading (0.35s delay)",
            "5th: CTA (0.5s delay)",
            "6th: Supporting elements (0.65s delay)"
        ],
        "SCROLL_ANIMATION_RULES": [
            "Start: element 40px below final position, opacity 0",
            "End: element at final position, opacity 1",
            "Duration: 0.6s",
            "Trigger: when element enters viewport by 20%",
            "Never animate things that are already in view on load"
        ],
        "HOVER_ANIMATION_RULES": [
            "Maximum hover duration: 0.25s (longer feels laggy)",
            "Never change layout on hover (no width/height changes)",
            "Transform and opacity only",
            "Give every interactive element a visible hover state"
        ],
        "LOADING_STATES": [
            "Every button that triggers async action needs a loading state",
            "Skeleton screens over spinners for content loading",
            "Optimistic UI: update immediately, revert on error"
        ]
    },

    "COPYWRITING_FOR_DESIGN": {
        "HIERARCHY_RULES": {
            "H1": "One per page. What this is. Max 8 words.",
            "H2": "Section titles. What this section is about. Max 6 words.",
            "H3": "Component titles. Max 5 words.",
            "Body": "Explain, support, detail. Max 3 sentences per block.",
            "CTA": "Verb + outcome. Never just 'Submit' or 'Click here'."
        },
        "CTA_FORMULAS": {
            "bad":  ["Submit", "Click here", "Learn more", "Get started"],
            "good": ["Start building free", "See the demo", 
                     "Download for Mac", "Join 10,000 engineers"]
        },
        "HEADLINE_FORMULAS": [
            "Outcome: 'Ship features 10x faster'",
            "Question: 'What if your AI actually understood you?'",
            "Contrast: 'Built for makers. Not enterprises.'",
            "Statement: 'The last tool you'll need.'",
            "Specificity: 'Save 4 hours every week on code reviews'"
        ]
    },

    "DARK_MODE_MASTERY": {
        "COMMON_MISTAKES": [
            "Using pure #000000 background — too harsh, use #0A0A0A or #080C10",
            "White text at 100% opacity — use 87% (#DEDEDE) maximum",
            "Same shadows as light mode — shadows don't work on dark, use glows",
            "Inverting light mode colors — dark mode needs its own palette",
            "Dark mode images too dark — increase image brightness 5-10% in CSS"
        ],
        "CORRECT_DARK_PALETTE": {
            "background":  "#0A0A0A (not #000000)",
            "surface_1":   "#141414 (cards, panels)",
            "surface_2":   "#1E1E1E (elevated elements)",
            "surface_3":   "#282828 (highest elevation)",
            "text_primary": "rgba(255,255,255,0.87)",
            "text_secondary": "rgba(255,255,255,0.6)",
            "text_disabled":  "rgba(255,255,255,0.38)",
            "border":      "rgba(255,255,255,0.08)"
        },
        "ELEVATION_THROUGH_LIGHTNESS": "In dark mode, elevation is shown by "
                                        "making surfaces lighter, not through shadows"
    },

    "DESIGN_CRITIQUE_CHECKLIST": [
        "Does every text element pass WCAG AA contrast?",
        "Is there a clear visual hierarchy (1 winner per section)?",
        "Is spacing consistent (8-point grid)?",
        "Does the design work at 375px mobile width?",
        "Are all interactive elements 44x44px minimum touch target?",
        "Do all hover states provide clear feedback?",
        "Is there a loading state for every async action?",
        "Are empty states designed?",
        "Is line-length under 75 characters for body text?",
        "Does the design match the selected DNA profile consistently?",
        "Is there a single dominant CTA or are multiple competing?",
        "Do all images have defined aspect ratios (no layout shift)?",
        "Is the navigation clear on both mobile and desktop?",
        "Does the design feel premium or generic?"
    ]
}