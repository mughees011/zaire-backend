/**
 * ZAIRE Mockup Renderer
 *
 * Converts a resolved design brief (visual_tokens + content_plan) into a
 * self-contained, fully-styled <!DOCTYPE html> string.
 *
 * No external APIs, no npm packages beyond what's already installed.
 * All section renderers output pure HTML/CSS (inline styles + a <style> block).
 */

// ─── Token Resolver ───────────────────────────────────────────────────────────

function resolveTokens(designBrief) {
  const vt = designBrief?.visual_tokens || {};
  const neutral = vt.neutral_scale || {};
  const typography = vt.typography || {};

  return {
    primaryColor: vt.primary_color || '#6366f1',
    bgColor:      neutral['900'] || neutral['50'] || '#0f0f14',
    surfaceColor: neutral['800'] || neutral['100'] || '#1a1a24',
    borderColor:  neutral['700'] || neutral['200'] || '#2a2a38',
    textColor:    neutral['50']  || neutral['900'] || '#f4f4f8',
    textMuted:    neutral['400'] || neutral['500'] || '#8888aa',
    displayFont:  typography.display || 'Inter',
    bodyFont:     typography.body    || 'Inter',
    borderRadius: vt.border_radius  || '12px',
    isDark:       !!(neutral['900'] && neutral['900'].toLowerCase() < '#888888')
  };
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function renderNavbar(tokens, content = {}) {
  const { bgColor, textColor, primaryColor, borderColor, displayFont } = tokens;
  const links = (content.navLinks || ['Features', 'Pricing', 'About'])
    .map(l => `<a href="#${l.toLowerCase().replace(/\s+/g,'-')}" style="color:${textColor};text-decoration:none;font-size:0.9rem;font-weight:500;opacity:0.8;transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">${l}</a>`)
    .join('\n');

  return `
  <nav style="position:sticky;top:0;z-index:100;background:${bgColor}ee;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid ${borderColor};padding:18px 48px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-family:'${displayFont}',sans-serif;font-size:1.3rem;font-weight:800;color:${textColor};letter-spacing:-0.03em">${content.brandName || 'Brand'}</span>
    <div style="display:flex;gap:32px;align-items:center">
      ${links}
      <a href="#cta" style="background:${primaryColor};color:#fff;padding:10px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.88rem;transition:opacity 0.2s" onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">${content.navCta || 'Get Started'}</a>
    </div>
  </nav>`;
}

function renderHero(tokens, content = {}, variant = 'centered') {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderColor, borderRadius } = tokens;

  if (variant === 'split') {
    return `
  <section style="display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:60px;padding:100px 60px;min-height:80vh;max-width:1200px;margin:0 auto">
    <div style="animation:fadeUp 0.7s ease both">
      <p style="color:${primaryColor};font-size:0.85rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px">${content.eyebrow || 'Introducing'}</p>
      <h1 style="font-family:'${displayFont}',sans-serif;font-size:clamp(2.2rem,4.5vw,3.6rem);font-weight:800;line-height:1.1;letter-spacing:-0.03em;color:${textColor};margin-bottom:20px">${content.headline || 'Your Big Headline'}</h1>
      <p style="color:${textMuted};font-size:1.1rem;line-height:1.75;margin-bottom:36px;max-width:480px">${content.subtext || 'A compelling subheadline that explains the value.'}</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <a href="#primary" style="background:${primaryColor};color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.95rem">${content.primaryCta || 'Get Started'}</a>
        ${content.secondaryCta ? `<a href="#secondary" style="border:1px solid ${borderColor};color:${textColor};padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:500;font-size:0.95rem">${content.secondaryCta}</a>` : ''}
      </div>
    </div>
    <div style="background:${surfaceColor};border:1px solid ${borderColor};border-radius:${borderRadius};aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;animation:fadeUp 0.7s 0.15s ease both">
      <span style="color:${textMuted};font-size:0.9rem">[ Product Visual ]</span>
    </div>
  </section>`;
  }

  // Default: centered
  return `
  <section style="min-height:88vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 32px;animation:fadeUp 0.8s ease both">
    <p style="color:${primaryColor};font-size:0.82rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:20px">${content.eyebrow || ''}</p>
    <h1 style="font-family:'${displayFont}',sans-serif;font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;line-height:1.08;letter-spacing:-0.04em;max-width:860px;margin:0 auto 24px;color:${textColor}">${content.headline || 'Your Big Headline Here'}</h1>
    <p style="color:${textMuted};font-size:1.15rem;line-height:1.75;max-width:560px;margin:0 auto 44px">${content.subtext || 'A compelling subheadline that clearly explains your value proposition.'}</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="#primary" style="background:${primaryColor};color:#fff;padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:700;font-size:1rem">${content.primaryCta || 'Get Started Free'}</a>
      ${content.secondaryCta ? `<a href="#secondary" style="border:1px solid ${borderColor};color:${textColor};padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:500;font-size:1rem">${content.secondaryCta}</a>` : ''}
    </div>
  </section>`;
}

function renderFeatures(tokens, content = {}, variant = 'grid') {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderColor, borderRadius } = tokens;
  const items = (content.items || [
    { title: 'Feature One', description: 'A short description of this powerful feature.' },
    { title: 'Feature Two', description: 'Another great capability that drives results.' },
    { title: 'Feature Three', description: 'The third reason your users will love this.' }
  ]).slice(0, 6);

  const cards = items.map((item, i) => `
    <div style="background:${surfaceColor};border:1px solid ${borderColor};border-radius:${borderRadius};padding:32px;animation:fadeUp 0.6s ${0.1 * i}s ease both">
      <div style="width:40px;height:40px;border-radius:10px;background:${primaryColor}22;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3 style="color:${textColor};font-size:1.05rem;font-weight:700;margin-bottom:8px">${item.title || 'Feature'}</h3>
      <p style="color:${textMuted};font-size:0.92rem;line-height:1.65">${item.description || ''}</p>
    </div>`).join('\n');

  const cols = items.length <= 2 ? 2 : items.length <= 4 ? 2 : 3;

  return `
  <section style="padding:100px 48px;max-width:1200px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:${textColor};margin-bottom:16px;letter-spacing:-0.03em">${content.headline || 'Everything You Need'}</h2>
      ${content.subtext ? `<p style="color:${textMuted};font-size:1.05rem;max-width:520px;margin:0 auto;line-height:1.7">${content.subtext}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:24px">
      ${cards}
    </div>
  </section>`;
}

function renderPricing(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderColor, borderRadius } = tokens;
  const tiers = (content.tiers || [
    { name: 'Starter', price: '$0', period: '/mo', features: ['5 projects', '2GB storage', 'Community support'] },
    { name: 'Pro', price: '$29', period: '/mo', features: ['Unlimited projects', '50GB storage', 'Priority support', 'Advanced analytics'], highlighted: true },
    { name: 'Enterprise', price: 'Custom', period: '', features: ['Everything in Pro', 'SSO', 'Dedicated support', 'SLA'] }
  ]);

  const cards = tiers.map(tier => {
    const isHighlighted = tier.highlighted;
    const featureList = (tier.features || []).map(f => `
      <li style="display:flex;align-items:center;gap:10px;color:${isHighlighted ? '#fff' : textMuted};font-size:0.9rem;padding:6px 0;border-bottom:1px solid ${isHighlighted ? 'rgba(255,255,255,0.1)' : borderColor}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isHighlighted ? '#fff' : primaryColor}" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${f}
      </li>`).join('');

    return `
    <div style="background:${isHighlighted ? primaryColor : surfaceColor};border:${isHighlighted ? '2px solid ' + primaryColor : '1px solid ' + borderColor};border-radius:${borderRadius};padding:40px;position:relative;${isHighlighted ? 'transform:scale(1.05);box-shadow:0 20px 60px ' + primaryColor + '44;' : ''}">
      ${isHighlighted ? `<div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#fff;color:${primaryColor};font-size:0.75rem;font-weight:800;padding:5px 16px;border-radius:999px;letter-spacing:0.08em">MOST POPULAR</div>` : ''}
      <h3 style="color:${isHighlighted ? '#fff' : textColor};font-size:1rem;font-weight:700;margin-bottom:8px">${tier.name}</h3>
      <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:24px">
        <span style="color:${isHighlighted ? '#fff' : textColor};font-family:'${displayFont}',sans-serif;font-size:2.8rem;font-weight:800">${tier.price}</span>
        <span style="color:${isHighlighted ? 'rgba(255,255,255,0.7)' : textMuted};font-size:0.9rem">${tier.period || ''}</span>
      </div>
      <ul style="list-style:none;padding:0;margin:0 0 32px 0">${featureList}</ul>
      <a href="#cta" style="display:block;text-align:center;background:${isHighlighted ? '#fff' : primaryColor};color:${isHighlighted ? primaryColor : '#fff'};padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:0.9rem">${tier.ctaLabel || 'Get Started'}</a>
    </div>`;
  }).join('\n');

  return `
  <section style="padding:100px 48px;max-width:1200px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:${textColor};margin-bottom:16px;letter-spacing:-0.03em">${content.headline || 'Simple, Transparent Pricing'}</h2>
      ${content.subtext ? `<p style="color:${textMuted};font-size:1.05rem;max-width:480px;margin:0 auto;line-height:1.7">${content.subtext}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(${tiers.length},1fr);gap:24px;align-items:center">
      ${cards}
    </div>
  </section>`;
}

function renderTestimonials(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderColor, borderRadius } = tokens;
  const items = (content.items || [
    { quote: 'This product completely transformed how our team works. We ship 3x faster.', author: 'Sarah K.', role: 'CTO, Acme Corp' },
    { quote: 'The best investment we made this year. Incredibly intuitive and powerful.', author: 'Marcus T.', role: 'Founder, StartupXYZ' },
    { quote: 'Outstanding support team and a product that just keeps getting better.', author: 'Linda R.', role: 'Head of Product, TechCo' }
  ]);

  const cards = items.map((item, i) => `
    <div style="background:${surfaceColor};border:1px solid ${borderColor};border-radius:${borderRadius};padding:32px;animation:fadeUp 0.6s ${0.1 * i}s ease both">
      <div style="color:${primaryColor};font-size:1.6rem;margin-bottom:16px;line-height:1">"</div>
      <p style="color:${textColor};font-size:0.95rem;line-height:1.75;margin-bottom:24px">${item.quote}</p>
      <div style="display:flex;align-items:center;gap:12px;border-top:1px solid ${borderColor};padding-top:20px">
        <div style="width:38px;height:38px;border-radius:50%;background:${primaryColor}33;display:flex;align-items:center;justify-content:center;color:${primaryColor};font-weight:700;font-size:0.9rem">${(item.author || 'A')[0]}</div>
        <div>
          <div style="color:${textColor};font-weight:700;font-size:0.88rem">${item.author || 'User'}</div>
          <div style="color:${textMuted};font-size:0.8rem">${item.role || ''}</div>
        </div>
      </div>
    </div>`).join('\n');

  return `
  <section style="padding:100px 48px;max-width:1200px;margin:0 auto">
    <div style="text-align:center;margin-bottom:64px">
      <h2 style="font-family:'${tokens.displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:${textColor};margin-bottom:16px;letter-spacing:-0.03em">${content.headline || 'Loved by Teams Worldwide'}</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(items.length, 3)},1fr);gap:24px">
      ${cards}
    </div>
  </section>`;
}

function renderStats(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, borderColor } = tokens;
  const items = content.items || [
    { value: '10K+', label: 'Active Users' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '4.9★', label: 'Average Rating' },
    { value: '$2M+', label: 'Revenue Generated' }
  ];

  const stats = items.map(s => `
    <div style="text-align:center;padding:40px 24px;border-right:1px solid ${borderColor}">
      <div style="font-family:'${displayFont}',sans-serif;font-size:3rem;font-weight:900;color:${primaryColor};line-height:1;margin-bottom:10px">${s.value}</div>
      <div style="color:${textMuted};font-size:0.9rem;font-weight:500">${s.label}</div>
    </div>`).join('\n');

  return `
  <section style="padding:80px 48px;max-width:1200px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(${items.length},1fr);border:1px solid ${borderColor};border-radius:16px;overflow:hidden">
      ${stats}
    </div>
  </section>`;
}

function renderCTA(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, bgColor, borderColor, borderRadius } = tokens;
  return `
  <section style="padding:100px 48px">
    <div style="max-width:900px;margin:0 auto;text-align:center;background:linear-gradient(135deg,${primaryColor}22 0%,${primaryColor}08 100%);border:1px solid ${primaryColor}44;border-radius:24px;padding:80px 60px">
      <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(2rem,4vw,3rem);font-weight:800;color:${textColor};margin-bottom:20px;letter-spacing:-0.03em">${content.headline || 'Ready to Get Started?'}</h2>
      <p style="color:${textMuted};font-size:1.1rem;line-height:1.7;max-width:520px;margin:0 auto 44px">${content.subtext || 'Join thousands of teams building better products faster.'}</p>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
        <a href="#primary" style="background:${primaryColor};color:#fff;padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:700;font-size:1rem">${content.ctaLabel || 'Start Free Today'}</a>
        ${content.secondaryCta ? `<a href="#secondary" style="border:1px solid ${borderColor};color:${textColor};padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:500;font-size:1rem">${content.secondaryCta}</a>` : ''}
      </div>
    </div>
  </section>`;
}

function renderContact(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderColor, borderRadius } = tokens;
  return `
  <section style="padding:100px 48px;max-width:860px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:${textColor};margin-bottom:16px;letter-spacing:-0.03em">${content.headline || "Get in Touch"}</h2>
      ${content.subtext ? `<p style="color:${textMuted};font-size:1rem;max-width:460px;margin:0 auto;line-height:1.7">${content.subtext}</p>` : ''}
    </div>
    <div style="background:${surfaceColor};border:1px solid ${borderColor};border-radius:${borderRadius};padding:48px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <label style="display:block;color:${textMuted};font-size:0.82rem;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">NAME</label>
          <div style="background:${tokens.bgColor};border:1px solid ${borderColor};border-radius:8px;padding:12px 16px;color:${textMuted};font-size:0.9rem">Your name</div>
        </div>
        <div>
          <label style="display:block;color:${textMuted};font-size:0.82rem;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">EMAIL</label>
          <div style="background:${tokens.bgColor};border:1px solid ${borderColor};border-radius:8px;padding:12px 16px;color:${textMuted};font-size:0.9rem">you@example.com</div>
        </div>
      </div>
      <div style="margin-bottom:24px">
        <label style="display:block;color:${textMuted};font-size:0.82rem;font-weight:600;margin-bottom:8px;letter-spacing:0.05em">MESSAGE</label>
        <div style="background:${tokens.bgColor};border:1px solid ${borderColor};border-radius:8px;padding:12px 16px;color:${textMuted};font-size:0.9rem;height:100px"></div>
      </div>
      <a href="#" style="display:inline-block;background:${primaryColor};color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:0.9rem">Send Message</a>
    </div>
  </section>`;
}

function renderAbout(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, borderColor } = tokens;
  const stats = (content.stats || []).map(s => `
    <div>
      <div style="font-family:'${displayFont}',sans-serif;font-size:2.2rem;font-weight:800;color:${primaryColor}">${s.value}</div>
      <div style="color:${textMuted};font-size:0.88rem;margin-top:4px">${s.label}</div>
    </div>`).join('\n');

  return `
  <section style="padding:100px 48px;max-width:1000px;margin:0 auto">
    <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.6rem);font-weight:800;color:${textColor};margin-bottom:20px;letter-spacing:-0.03em">${content.headline || 'About Us'}</h2>
    <p style="color:${textMuted};font-size:1.05rem;line-height:1.8;max-width:680px;margin-bottom:48px">${content.body || 'We are a passionate team dedicated to building the best tools for modern teams.'}</p>
    ${stats ? `<div style="display:flex;gap:48px;border-top:1px solid ${borderColor};padding-top:32px">${stats}</div>` : ''}
  </section>`;
}

function renderSocialProof(tokens, content = {}) {
  const { textMuted, borderColor } = tokens;
  const logos = (content.logos || ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne']);
  const logoItems = logos.map(name => `
    <div style="color:${textMuted};font-weight:700;font-size:1rem;opacity:0.5;letter-spacing:-0.02em">${name}</div>`).join('\n');

  return `
  <section style="padding:60px 48px;border-top:1px solid ${borderColor};border-bottom:1px solid ${borderColor}">
    <div style="max-width:1000px;margin:0 auto">
      <p style="text-align:center;color:${textMuted};font-size:0.82rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px">${content.label || 'Trusted by Teams at'}</p>
      <div style="display:flex;justify-content:center;align-items:center;gap:48px;flex-wrap:wrap">${logoItems}</div>
    </div>
  </section>`;
}

function renderFAQ(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderColor, borderRadius } = tokens;
  const items = content.items || [
    { question: 'How does it work?', answer: 'It works by connecting your existing workflow with our powerful API.' },
    { question: 'Is there a free trial?', answer: 'Yes, you can start for free with no credit card required.' },
    { question: 'Can I cancel anytime?', answer: 'Absolutely. Cancel your subscription at any time, no questions asked.' }
  ];

  const faqs = items.map((item, i) => `
    <div style="background:${surfaceColor};border:1px solid ${borderColor};border-radius:${borderRadius};padding:28px 32px;margin-bottom:12px">
      <div style="color:${textColor};font-weight:700;font-size:0.95rem;margin-bottom:10px">${item.question}</div>
      <div style="color:${textMuted};font-size:0.9rem;line-height:1.65">${item.answer}</div>
    </div>`).join('\n');

  return `
  <section style="padding:100px 48px;max-width:800px;margin:0 auto">
    <div style="text-align:center;margin-bottom:56px">
      <h2 style="font-family:'${displayFont}',sans-serif;font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;color:${textColor};margin-bottom:16px;letter-spacing:-0.03em">${content.headline || 'Frequently Asked Questions'}</h2>
    </div>
    ${faqs}
  </section>`;
}

function renderFooter(tokens, content = {}) {
  const { textColor, textMuted, primaryColor, displayFont, bgColor, borderColor } = tokens;
  const columns = (content.columns || [
    { title: 'Product', links: ['Features', 'Pricing', 'Changelog'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers'] },
    { title: 'Legal', links: ['Privacy', 'Terms'] }
  ]);

  const cols = columns.map(col => `
    <div>
      <div style="color:${textColor};font-weight:700;font-size:0.88rem;margin-bottom:20px;letter-spacing:0.05em;text-transform:uppercase">${col.title}</div>
      ${(col.links || []).map(l => `<a href="#" style="display:block;color:${textMuted};text-decoration:none;font-size:0.9rem;margin-bottom:10px;transition:color 0.2s" onmouseover="this.style.color='${textColor}'" onmouseout="this.style.color='${textMuted}'">${l}</a>`).join('\n')}
    </div>`).join('\n');

  return `
  <footer style="border-top:1px solid ${borderColor};padding:64px 48px 40px;margin-top:40px">
    <div style="max-width:1200px;margin:0 auto">
      <div style="display:grid;grid-template-columns:2fr ${columns.map(() => '1fr').join(' ')};gap:48px;margin-bottom:64px">
        <div>
          <span style="font-family:'${displayFont}',sans-serif;font-size:1.3rem;font-weight:800;color:${textColor};letter-spacing:-0.03em;display:block;margin-bottom:16px">${content.brandName || 'Brand'}</span>
          <p style="color:${textMuted};font-size:0.9rem;line-height:1.65;max-width:280px">${content.tagline || 'Building the future, one feature at a time.'}</p>
        </div>
        ${cols}
      </div>
      <div style="border-top:1px solid ${borderColor};padding-top:32px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:${textMuted};font-size:0.84rem">© ${new Date().getFullYear()} ${content.copyrightName || 'Brand'}. All rights reserved.</span>
        <span style="color:${textMuted};font-size:0.84rem">Built with <span style="color:${primaryColor}">ZAIRE</span></span>
      </div>
    </div>
  </footer>`;
}

// ─── Section Dispatcher ───────────────────────────────────────────────────────

function dispatchSection(type, variant, tokens, content) {
  const t = String(type || '').toLowerCase();
  const v = String(variant || '').toLowerCase();

  if (/navbar|nav/.test(t))        return renderNavbar(tokens, content);
  if (/hero/.test(t))              return renderHero(tokens, content, v === 'split' ? 'split' : 'centered');
  if (/feature|service|bento/.test(t)) return renderFeatures(tokens, content, v);
  if (/pricing|plan|tier/.test(t)) return renderPricing(tokens, content);
  if (/testimonial|review|quote/.test(t)) return renderTestimonials(tokens, content);
  if (/stat|counter|metric/.test(t))   return renderStats(tokens, content);
  if (/social.proof|partner|logo/.test(t)) return renderSocialProof(tokens, content);
  if (/about|mission|story/.test(t))   return renderAbout(tokens, content);
  if (/faq|question/.test(t))          return renderFAQ(tokens, content);
  if (/contact/.test(t))               return renderContact(tokens, content);
  if (/cta|call.to.action|banner/.test(t)) return renderCTA(tokens, content);
  if (/footer/.test(t))                return renderFooter(tokens, content);

  return ''; // Unknown section — skip silently
}

// ─── Main Generator ───────────────────────────────────────────────────────────

function generateMockup(designBrief) {
  const tokens   = resolveTokens(designBrief);
  const { displayFont, bodyFont, bgColor, textColor } = tokens;

  // Gather sections from the first content_plan page
  const page = (designBrief?.content_plan || [])[0];
  const rawSections = page?.page_sections || [];

  // Always ensure navbar + footer exist
  const sectionsToRender = [];
  const hasNavbar = rawSections.some(s => /navbar|nav/i.test(s.type || ''));
  const hasFooter = rawSections.some(s => /footer/i.test(s.type || ''));

  if (!hasNavbar) {
    sectionsToRender.push({ type: 'navbar', content: { brandName: designBrief?.app_name || 'Brand' } });
  }

  for (const section of rawSections) {
    sectionsToRender.push(section);
  }

  if (!hasFooter) {
    sectionsToRender.push({ type: 'footer', content: { brandName: designBrief?.app_name || 'Brand' } });
  }

  // Render all sections
  const sectionHtml = sectionsToRender.map(s =>
    dispatchSection(s.type, s.variant, tokens, s.content || {})
  ).join('\n\n');

  // Google Fonts — deduplicate display/body fonts
  const fonts = [...new Set([displayFont, bodyFont].filter(Boolean))];
  const googleFontsUrl = fonts.length
    ? `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&display=swap`
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${designBrief?.app_name || 'ZAIRE Mockup'} — Preview</title>
  ${googleFontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}" rel="stylesheet">` : ''}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: '${bodyFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bgColor};
      color: ${textColor};
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
      overflow-x: hidden;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: ${bgColor}; }
    ::-webkit-scrollbar-thumb { background: ${tokens.borderColor}; border-radius: 3px; }
    /* ZAIRE Watermark */
    .zaire-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${tokens.surfaceColor};
      border: 1px solid ${tokens.borderColor};
      color: ${tokens.textMuted};
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 6px 14px;
      border-radius: 999px;
      z-index: 9999;
      font-family: -apple-system, sans-serif;
    }
    .zaire-badge span { color: ${tokens.primaryColor}; }
  </style>
</head>
<body>

${sectionHtml}

<div class="zaire-badge">Generated by <span>ZAIRE</span></div>

</body>
</html>`;
}

module.exports = { generateMockup, resolveTokens };
