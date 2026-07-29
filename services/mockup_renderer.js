/**
 * ZAIRE Mockup Renderer (EXTRAORDINARY EDITION)
 *
 * Converts a structured Design Brief JSON into a full <!DOCTYPE html> page.
 * This is served directly to the frontend iframe via srcDoc for instant visual preview.
 * No React, no bundler — pure HTML/CSS using the Tailwind CDN for rapid preview rendering.
 */

/**
 * Generates a complete HTML mockup from a design brief.
 * @param {Object} designBrief - The structured design brief from the AI.
 * @returns {string} A complete <!DOCTYPE html> string.
 */
function generateMockupHTML(designBrief) {
  const vt = designBrief?.visual_tokens || {};
  const cp = designBrief?.content_plan?.[0] || {};
  const sections = cp.page_sections || [];

  const bg = vt.background_color || '#050505';
  const text = vt.text_color || '#ffffff';
  const primary = vt.primary_color || '#6366f1';
  const surface = vt.neutral_scale ? shiftHex(vt.neutral_scale, 15) : (isDark(bg) ? '#111111' : '#f3f4f6');
  const border = isDark(bg) ? '#27272a' : '#e5e7eb';
  const muted = isDark(bg) ? '#9ca3af' : '#6b7280';
  const displayFont = vt.typography?.display || 'Inter';
  const bodyFont = vt.typography?.body || 'DM Sans';
  const radius = vt.border_radius || '12px';

  const appTitle = cp.core_message || 'Your Next Big Project';
  const fontsUrl = buildGoogleFontsUrl([displayFont, bodyFont]);

  const sectionHTML = sections.map(sec => renderMockupSection(sec, { bg, text, primary, surface, border, muted, displayFont, bodyFont, radius })).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appTitle)} — ZAIRE Preview</title>
  ${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontsUrl}" rel="stylesheet">` : ''}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: ${bg};
      color: ${text};
      font-family: '${bodyFont}', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: '${displayFont}', system-ui, sans-serif;
      line-height: 1.15;
    }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; }
    ::selection { background: ${primary}; color: #fff; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${primary}; border-radius: 99px; }

    /* Layout utilities */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    @media (max-width: 768px) {
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; gap: 24px; }
    }
    @media (max-width: 1024px) {
      .grid-3 { grid-template-columns: 1fr 1fr; }
    }

    /* Glassmorphism card */
    .glass-card {
      background: ${surface}99;
      border: 1px solid ${border};
      border-radius: ${radius};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      overflow: hidden;
    }

    /* Glow effect */
    .glow { box-shadow: 0 0 30px ${primary}44; }

    /* Button */
    .btn-primary {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      background: ${primary};
      color: #fff;
      padding: 14px 32px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1rem;
      border: none;
      cursor: pointer;
      box-shadow: 0 0 0 0 ${primary}66;
      transition: all 0.3s ease;
    }
    .btn-primary:hover { box-shadow: 0 0 28px ${primary}66; transform: translateY(-2px); }

    .btn-secondary {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      background: transparent;
      color: ${text};
      padding: 14px 32px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 1rem;
      border: 1px solid ${border};
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .btn-secondary:hover { background: ${text}10; }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 999px;
      border: 1px solid ${primary}44;
      background: ${primary}15;
      color: ${primary};
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    /* Radial glow blob */
    .radial-glow {
      position: absolute;
      border-radius: 999px;
      filter: blur(100px);
      pointer-events: none;
      z-index: 0;
    }
    section, nav, footer { position: relative; z-index: 1; }

    /* ZAIRE watermark badge */
    .zaire-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${primary};
      color: #fff;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      z-index: 9999;
      box-shadow: 0 4px 20px ${primary}66;
    }
  </style>
</head>
<body>

${sectionHTML || generateFallbackMockup({ bg, text, primary, surface, border, muted, displayFont, bodyFont, radius, appTitle })}

<div class="zaire-badge">✦ ZAIRE PREVIEW</div>

</body>
</html>`;
}

// ── Section Renderers ──────────────────────────────────────────────────────

function renderMockupSection(sec, tokens) {
  const { type, variant, content } = sec;
  if (!content) return '';

  const renderers = {
    navbar: renderNavbar,
    hero: variant === 'split' ? renderHeroSplit : renderHeroCentered,
    features: renderFeatures,
    pricing: renderPricing,
    testimonials: renderTestimonials,
    stats: renderStats,
    cta: renderCTA,
    contact: renderContact,
    social_proof: renderSocialProof,
    about: renderAbout,
    footer: renderFooter,
  };

  const fn = renderers[type];
  if (!fn) return '';
  try { return fn(tokens, content); } catch (e) { return `<!-- Section '${type}' render failed: ${e.message} -->`; }
}

function renderNavbar(tokens, content) {
  const { bg, text, primary, border, displayFont } = tokens;
  const links = (content.links || []).map(l => `<a href="${l.href || '#'}" style="color:${text}aa;font-size:0.9rem;font-weight:500;transition:color 0.2s" onmouseover="this.style.color='${primary}'" onmouseout="this.style.color='${text}aa'">${escapeHtml(l.label)}</a>`).join('');
  return `
  <nav style="position:sticky;top:0;z-index:50;background:${bg}cc;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid ${border}66;padding:0 32px;height:72px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-family:'${displayFont}',sans-serif;font-size:1.35rem;font-weight:800;background:linear-gradient(135deg,${text},${primary});-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(content.logoText || 'Brand')}</span>
    <div style="display:flex;gap:32px;align-items:center">${links}<a href="${content.ctaHref || '#'}" class="btn-primary" style="padding:10px 24px;font-size:0.9rem">${escapeHtml(content.ctaLabel || 'Get Started')}</a></div>
  </nav>`;
}

function renderHeroCentered(tokens, content) {
  const { bg, text, primary, muted, displayFont, bodyFont } = tokens;
  return `
  <section style="min-height:90vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 32px 80px;background:${bg};overflow:hidden;">
    <div class="radial-glow" style="width:600px;height:600px;background:${primary}22;top:-200px;left:50%;transform:translateX(-50%)"></div>
    <div class="badge">${escapeHtml(content.tagline || 'Introducing ZAIRE')}</div>
    <h1 style="font-family:'${displayFont}',serif;font-size:clamp(2.8rem,6vw,5rem);font-weight:900;letter-spacing:-0.03em;color:${text};max-width:860px;margin-bottom:28px;line-height:1.08">${escapeHtml(content.headline || 'Build Extraordinary Products')}</h1>
    <p style="font-family:'${bodyFont}',sans-serif;color:${muted};font-size:1.25rem;line-height:1.75;max-width:560px;margin:0 auto 48px">${escapeHtml(content.subtext || 'A new generation of AI-powered design.')}</p>
    <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
      <a href="${content.ctaHref || '#'}" class="btn-primary glow">${escapeHtml(content.ctaLabel || 'Get Started')} →</a>
      <a href="#demo" class="btn-secondary">Watch Demo ▶</a>
    </div>
  </section>`;
}

function renderHeroSplit(tokens, content) {
  const { bg, text, primary, muted, surface, border, displayFont, bodyFont, radius } = tokens;
  return `
  <section style="min-height:90vh;display:flex;align-items:center;padding:80px 32px;background:${bg};overflow:hidden;">
    <div class="radial-glow" style="width:500px;height:500px;background:${primary}20;top:-100px;right:-100px;"></div>
    <div class="container grid-2">
      <div>
        <div class="badge">${escapeHtml(content.tagline || 'Just Launched')}</div>
        <h1 style="font-family:'${displayFont}',serif;font-size:clamp(2.4rem,5vw,4.2rem);font-weight:900;letter-spacing:-0.03em;color:${text};margin-bottom:24px;line-height:1.1">${escapeHtml(content.headline || 'Build Extraordinary Products')}</h1>
        <p style="font-family:'${bodyFont}',sans-serif;color:${muted};font-size:1.15rem;line-height:1.75;margin-bottom:40px;max-width:460px">${escapeHtml(content.subtext || 'The most powerful design & engineering platform.')}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <a href="${content.ctaHref || '#'}" class="btn-primary glow">${escapeHtml(content.ctaLabel || 'Get Started')}</a>
          <a href="#features" class="btn-secondary">Learn more</a>
        </div>
      </div>
      <div class="glass-card" style="aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${surface},${bg})">
        <div style="width:80px;height:80px;border-radius:20px;background:${primary}33;display:flex;align-items:center;justify-content:center;font-size:2rem">✦</div>
      </div>
    </div>
  </section>`;
}

function renderFeatures(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont, bodyFont, radius } = tokens;
  const items = (content.items || []).slice(0, 6);
  const cards = items.map((item, i) => `
    <div class="glass-card" style="padding:32px;transition:all 0.3s ease" onmouseover="this.style.borderColor='${primary}55';this.style.transform='translateY(-4px)'" onmouseout="this.style.borderColor='${border}';this.style.transform='translateY(0)'">
      <div style="width:52px;height:52px;border-radius:14px;background:${primary}18;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:20px;color:${primary}">${item.icon || '◆'}</div>
      <h3 style="font-family:'${displayFont}',sans-serif;font-size:1.15rem;font-weight:700;color:${text};margin-bottom:10px">${escapeHtml(item.title || 'Feature')}</h3>
      <p style="font-family:'${bodyFont}',sans-serif;color:${muted};font-size:0.95rem;line-height:1.65">${escapeHtml(item.description || '')}</p>
    </div>`).join('');

  const colsStyle = items.length <= 2 ? 'grid-template-columns:repeat(2,1fr)' : items.length === 4 ? 'grid-template-columns:repeat(4,1fr)' : 'grid-template-columns:repeat(3,1fr)';

  return `
  <section style="padding:120px 32px;background:${bg}">
    <div class="container">
      <div style="text-align:center;margin-bottom:72px">
        <h2 style="font-family:'${displayFont}',serif;font-size:clamp(1.8rem,3.5vw,3rem);font-weight:800;color:${text};margin-bottom:16px">${escapeHtml(content.heading || 'Everything you need')}</h2>
        <div style="width:60px;height:3px;background:${primary};margin:0 auto;border-radius:99px"></div>
      </div>
      <div style="display:grid;${colsStyle};gap:24px">${cards}</div>
    </div>
  </section>`;
}

function renderPricing(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont, bodyFont, radius } = tokens;
  const tiers = (content.tiers || []).slice(0, 3);
  const cards = tiers.map(tier => `
    <div class="glass-card" style="padding:40px 32px;text-align:center;border-color:${tier.highlighted ? primary : border};${tier.highlighted ? `transform:scale(1.05);box-shadow:0 0 40px ${primary}33` : ''}">
      ${tier.highlighted ? `<div style="display:inline-block;background:${primary};color:#fff;padding:4px 16px;border-radius:999px;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px">Most Popular</div>` : ''}
      <h3 style="font-family:'${displayFont}',sans-serif;font-size:1.1rem;font-weight:500;color:${tier.highlighted ? text : muted};margin-bottom:8px">${escapeHtml(tier.name || 'Plan')}</h3>
      <div style="font-family:'${displayFont}',serif;font-size:3.5rem;font-weight:900;color:${text};line-height:1;margin-bottom:8px">${escapeHtml(tier.price || '$0')}</div>
      <div style="color:${muted};font-size:0.9rem;margin-bottom:32px">per month</div>
      <ul style="list-style:none;text-align:left;margin-bottom:36px">
        ${(tier.features || []).map(f => `<li style="display:flex;align-items:center;gap:10px;color:${muted};font-size:0.9rem;padding:8px 0;border-bottom:1px solid ${border}33"><span style="color:${primary};font-weight:700">✓</span>${escapeHtml(f)}</li>`).join('')}
      </ul>
      <a href="#" class="${tier.highlighted ? 'btn-primary glow' : 'btn-secondary'}" style="width:100%;display:block">Choose ${escapeHtml(tier.name || 'Plan')}</a>
    </div>`).join('');

  return `
  <section style="padding:120px 32px;background:${bg}">
    <div class="container">
      <div style="text-align:center;margin-bottom:72px">
        <h2 style="font-family:'${displayFont}',serif;font-size:clamp(1.8rem,3.5vw,3rem);font-weight:800;color:${text};margin-bottom:16px">Simple, transparent pricing</h2>
        <p style="color:${muted};font-size:1.1rem">Choose the plan that works best for you.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(tiers.length, 3)},1fr);gap:24px;align-items:center;max-width:900px;margin:0 auto">${cards}</div>
    </div>
  </section>`;
}

function renderTestimonials(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont, bodyFont, radius } = tokens;
  const items = (content.items || []).slice(0, 3);
  const cards = items.map(t => `
    <div class="glass-card" style="padding:32px">
      <div style="display:flex;gap:4px;margin-bottom:20px">${'★'.repeat(5).split('').map(s => `<span style="color:#f59e0b">${s}</span>`).join('')}</div>
      <p style="font-family:'${bodyFont}',sans-serif;color:${text};font-size:1rem;line-height:1.75;margin-bottom:24px;font-style:italic">"${escapeHtml(t.quote || 'An amazing product.')}"</p>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${primary}44,${surface})"></div>
        <div>
          <div style="font-weight:700;color:${text};font-size:0.95rem">${escapeHtml(t.author || 'Customer')}</div>
          <div style="color:${muted};font-size:0.8rem">${escapeHtml(t.role || 'Verified User')}</div>
        </div>
      </div>
    </div>`).join('');

  return `
  <section style="padding:120px 32px;background:${bg}">
    <div class="container">
      <h2 style="font-family:'${displayFont}',serif;font-size:clamp(1.8rem,3.5vw,3rem);font-weight:800;color:${text};text-align:center;margin-bottom:72px">Loved by thousands</h2>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(items.length, 3)},1fr);gap:24px">${cards}</div>
    </div>
  </section>`;
}

function renderStats(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont } = tokens;
  const items = (content.items || []).slice(0, 4);
  const stats = items.map(s => `
    <div style="text-align:center">
      <div style="font-family:'${displayFont}',serif;font-size:3.5rem;font-weight:900;background:linear-gradient(135deg,${primary},${primary}99);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px">${escapeHtml(s.value || '0')}</div>
      <div style="color:${muted};font-size:1rem;font-weight:500">${escapeHtml(s.label || '')}</div>
    </div>`).join('');
  return `
  <section style="padding:80px 32px;background:${bg}">
    <div class="container">
      <div class="glass-card" style="padding:72px 48px">
        <div style="display:grid;grid-template-columns:repeat(${Math.min(items.length, 4)},1fr);gap:40px;align-items:center">${stats}</div>
      </div>
    </div>
  </section>`;
}

function renderCTA(tokens, content) {
  const { bg, text, primary, displayFont, bodyFont } = tokens;
  return `
  <section style="padding:80px 32px;background:${bg}">
    <div class="container">
      <div style="background:${primary};border-radius:32px;padding:80px 48px;text-align:center;position:relative;overflow:hidden;box-shadow:0 0 80px ${primary}44">
        <div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;background:rgba(255,255,255,0.08);border-radius:50%"></div>
        <div style="position:absolute;bottom:-80px;right:-80px;width:300px;height:300px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="position:relative;z-index:1">
          <h2 style="font-family:'${displayFont}',serif;font-size:clamp(2rem,4vw,3.5rem);font-weight:900;color:#fff;margin-bottom:20px">${escapeHtml(content.heading || 'Ready to get started?')}</h2>
          <p style="font-family:'${bodyFont}',sans-serif;color:rgba(255,255,255,0.8);font-size:1.2rem;margin-bottom:40px;max-width:560px;margin-left:auto;margin-right:auto">${escapeHtml(content.subtext || 'Join thousands of teams building the future.')}</p>
          <a href="${content.ctaHref || '#'}" style="display:inline-flex;align-items:center;gap:8px;background:#fff;color:${primary};padding:16px 40px;border-radius:999px;font-weight:800;font-size:1.1rem;box-shadow:0 8px 30px rgba(0,0,0,0.2);transition:all 0.3s" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">${escapeHtml(content.ctaLabel || 'Get Started')} ↗</a>
        </div>
      </div>
    </div>
  </section>`;
}

function renderContact(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont, bodyFont, radius } = tokens;
  return `
  <section style="padding:120px 32px;background:${bg}">
    <div class="container">
      <div class="grid-2">
        <div>
          <h2 style="font-family:'${displayFont}',serif;font-size:clamp(2rem,4vw,3rem);font-weight:800;color:${text};margin-bottom:20px">${escapeHtml(content.heading || 'Get in touch')}</h2>
          <p style="color:${muted};font-size:1.1rem;line-height:1.75;margin-bottom:40px">${escapeHtml(content.subtext || 'We\'d love to hear from you.')}</p>
        </div>
        <div class="glass-card" style="padding:40px">
          <div style="display:flex;flex-direction:column;gap:16px">
            <input placeholder="Your Name" style="background:transparent;border:1px solid ${border};border-radius:${radius};padding:14px 16px;color:${text};font-family:'${bodyFont}',sans-serif;font-size:0.95rem;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primary}'" onblur="this.style.borderColor='${border}'">
            <input placeholder="Email Address" style="background:transparent;border:1px solid ${border};border-radius:${radius};padding:14px 16px;color:${text};font-family:'${bodyFont}',sans-serif;font-size:0.95rem;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primary}'" onblur="this.style.borderColor='${border}'">
            <textarea rows="4" placeholder="Message" style="background:transparent;border:1px solid ${border};border-radius:${radius};padding:14px 16px;color:${text};font-family:'${bodyFont}',sans-serif;font-size:0.95rem;resize:none;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primary}'" onblur="this.style.borderColor='${border}'"></textarea>
            <button class="btn-primary glow" style="width:100%">${escapeHtml(content.submitLabel || 'Send Message')}</button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSocialProof(tokens, content) {
  const { bg, text, border, muted } = tokens;
  const logos = (content.logos || []).map(name => `<div style="color:${muted};font-weight:700;font-size:1.25rem;letter-spacing:-0.02em;opacity:0.5;cursor:pointer;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">${escapeHtml(name)}</div>`).join('');
  return `
  <section style="padding:48px 32px;border-top:1px solid ${border}44;border-bottom:1px solid ${border}44;background:${bg}">
    <div class="container">
      <p style="text-align:center;color:${muted};font-size:0.8rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:32px">Trusted by world-class teams</p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:48px">${logos}</div>
    </div>
  </section>`;
}

function renderAbout(tokens, content) {
  const { bg, text, muted, displayFont, bodyFont } = tokens;
  return `
  <section style="padding:120px 32px;background:${bg}">
    <div class="container" style="text-align:center;max-width:800px;margin:0 auto">
      <h2 style="font-family:'${displayFont}',serif;font-size:clamp(2rem,4vw,3rem);font-weight:800;color:${text};margin-bottom:24px">${escapeHtml(content.heading || 'About Us')}</h2>
      <p style="font-family:'${bodyFont}',sans-serif;color:${muted};font-size:1.15rem;line-height:1.85">${escapeHtml(content.body || '')}</p>
    </div>
  </section>`;
}

function renderFooter(tokens, content) {
  const { bg, text, primary, surface, border, muted, displayFont } = tokens;
  const links = (content.links || []).map(l => `<a href="${l.href || '#'}" style="color:${muted};font-size:0.9rem;transition:color 0.2s" onmouseover="this.style.color='${primary}'" onmouseout="this.style.color='${muted}'">${escapeHtml(l.label)}</a>`).join('');
  return `
  <footer style="background:${bg};border-top:1px solid ${border};padding:48px 32px 32px">
    <div class="container" style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:24px">
      <span style="font-family:'${displayFont}',sans-serif;font-size:1.25rem;font-weight:800;color:${text}">${escapeHtml(content.logoText || 'Brand')}</span>
      <div style="display:flex;gap:32px;flex-wrap:wrap">${links}</div>
      <p style="color:${muted};font-size:0.85rem">© ${new Date().getFullYear()} ${escapeHtml(content.logoText || 'Brand')}. All rights reserved.</p>
    </div>
  </footer>`;
}

// ── Fallback full page ────────────────────────────────────────────────────

function generateFallbackMockup({ bg, text, primary, surface, border, muted, displayFont, bodyFont, radius, appTitle }) {
  return `
  <nav style="position:sticky;top:0;z-index:50;background:${bg}cc;backdrop-filter:blur(20px);border-bottom:1px solid ${border};padding:0 32px;height:72px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-family:'${displayFont}',sans-serif;font-size:1.35rem;font-weight:800;color:${text}">${escapeHtml(appTitle)}</span>
    <a href="#" class="btn-primary" style="padding:10px 24px;font-size:0.9rem">Get Started</a>
  </nav>
  <section style="min-height:90vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 32px;background:${bg};position:relative;overflow:hidden">
    <div class="radial-glow" style="width:800px;height:800px;background:${primary}18;top:50%;left:50%;transform:translate(-50%,-50%)"></div>
    <div style="position:relative;z-index:1;max-width:800px">
      <div class="badge">Just Launched</div>
      <h1 style="font-family:'${displayFont}',serif;font-size:clamp(3rem,7vw,5.5rem);font-weight:900;letter-spacing:-0.04em;color:${text};margin-bottom:28px;line-height:1.05">${escapeHtml(appTitle)}</h1>
      <p style="color:${muted};font-size:1.2rem;line-height:1.75;max-width:540px;margin:0 auto 48px">A premium digital experience crafted with precision and powered by AI.</p>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
        <a href="#" class="btn-primary glow">Get Started →</a>
        <a href="#" class="btn-secondary">Learn More</a>
      </div>
    </div>
  </section>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isDark(hex) {
  const clean = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return true;
  const r = parseInt(clean.substr(0,2), 16);
  const g = parseInt(clean.substr(2,2), 16);
  const b = parseInt(clean.substr(4,2), 16);
  return (0.299*r + 0.587*g + 0.114*b) < 128;
}

function shiftHex(hex, amount) {
  const clean = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#111111';
  const r = Math.min(255, parseInt(clean.substr(0,2), 16) + amount);
  const g = Math.min(255, parseInt(clean.substr(2,2), 16) + amount);
  const b = Math.min(255, parseInt(clean.substr(4,2), 16) + amount);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildGoogleFontsUrl(fonts) {
  const unique = [...new Set(fonts.filter(Boolean))];
  if (!unique.length) return '';
  const families = unique.map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800;900`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

module.exports = { generateMockupHTML };
