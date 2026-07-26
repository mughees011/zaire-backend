/**
 * ZAIRE Section Library — Starter Set
 *
 * Each function takes (tokens, content) and returns a JSX string block,
 * matching the inline-style + template-literal convention already used in
 * buildPageContent (engineer_workflow.js). The generation pipeline SELECTS
 * from these and fills in content — it does not freehand section JSX from
 * scratch. This is the "assembly beats invention" fix from the design DNA
 * discussion, applied to full sections instead of just animations.
 *
 * tokens shape (matches resolveDesignTokens output):
 *   { primaryColor, neutralScale, displayFont, bodyFont, borderRadius,
 *     bgColor, surfaceColor, borderColor, textMuted, textColor }
 *
 * content shape (per section, sourced from design_brief.content_plan —
 * NEVER raw intake fields, per the generation-completeness fix):
 *   varies per section, documented above each function.
 */

// ── NAVBAR ───────────────────────────────────────────────────────────────
function navbarStandard(tokens, content) {
  const { bgColor, textColor, primaryColor, borderColor, displayFont } = tokens;
  const links = (content.navLinks || ['Home', 'About', 'Pricing', 'Contact'])
    .map((l) => `<a href="#${l.toLowerCase()}" style={{ color: '${textColor}', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>${l}</a>`).join('\n            ');
  return `
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '${bgColor}ee', backdropFilter: 'blur(12px)', borderBottom: '1px solid ${borderColor}', padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'${displayFont}', sans-serif", fontSize: '1.3rem', fontWeight: 700, color: '${textColor}' }}>${content.brandName || 'Brand'}</span>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          ${links}
          <a href="#cta" style={{ background: '${primaryColor}', color: '#fff', padding: '10px 22px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>${content.navCta || 'Get Started'}</a>
        </div>
      </nav>`;
}

// ── HERO ─────────────────────────────────────────────────────────────────
// content: { headline, subtext, primaryCta, secondaryCta }
function heroCentered(tokens, content) {
  const { textColor, textMuted, primaryColor, displayFont } = tokens;
  return `
      <section style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '100px 32px' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
          <h1 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: '820px', margin: '0 auto 24px', color: '${textColor}' }}>${content.headline}</h1>
          <p style={{ color: '${textMuted}', fontSize: '1.15rem', lineHeight: 1.7, maxWidth: '580px', margin: '0 auto 40px' }}>${content.subtext}</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <a href="#primary" style={{ background: '${primaryColor}', color: '#fff', padding: '15px 36px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600 }}>${content.primaryCta}</a>
            ${content.secondaryCta ? `<a href="#secondary" style={{ border: '1px solid ${textColor}33', color: '${textColor}', padding: '15px 36px', borderRadius: '999px', textDecoration: 'none', fontWeight: 500 }}>${content.secondaryCta}</a>` : ''}
          </div>
        </motion.div>
      </section>`;
}

// content: { headline, subtext, primaryCta, imageAlt }
function heroSplit(tokens, content) {
  const { textColor, textMuted, primaryColor, displayFont, surfaceColor, borderRadius } = tokens;
  return `
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: '60px', padding: '100px 60px', minHeight: '80vh' }}>
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
          <h1 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)', fontWeight: 700, lineHeight: 1.15, color: '${textColor}', marginBottom: '20px' }}>${content.headline}</h1>
          <p style={{ color: '${textMuted}', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: '32px', maxWidth: '460px' }}>${content.subtext}</p>
          <a href="#primary" style={{ background: '${primaryColor}', color: '#fff', padding: '15px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}>${content.primaryCta}</a>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} style={{ background: '${surfaceColor}', borderRadius: '${borderRadius}', aspectRatio: '4/3' }} aria-label="${content.imageAlt || 'Product visual'}" />
      </section>`;
}

// ── ABOUT ────────────────────────────────────────────────────────────────
// content: { headline, body, stats: [{value, label}] }
function aboutSection(tokens, content) {
  const { textColor, textMuted, primaryColor, displayFont, borderColor } = tokens;
  const stats = (content.stats || []).map((s) => `
          <div><div style={{ fontSize: '2rem', fontWeight: 700, color: '${primaryColor}' }}>${s.value}</div><div style={{ color: '${textMuted}', fontSize: '0.9rem' }}>${s.label}</div></div>`).join('');
  return `
      <section style={{ padding: '100px 60px', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', marginBottom: '20px' }}>${content.headline}</h2>
        <p style={{ color: '${textMuted}', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '680px', marginBottom: '48px' }}>${content.body}</p>
        ${stats ? `<div style={{ display: 'flex', gap: '48px', borderTop: '1px solid ${borderColor}', paddingTop: '32px' }}>${stats}</div>` : ''}
      </section>`;
}

// ── FEATURES / SERVICES ──────────────────────────────────────────────────
// content: { headline, items: [{title, description, icon}] }
function featuresGrid(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderColor, borderRadius, displayFont } = tokens;
  const cards = (content.items || []).map((f, i) => `
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ${i * 0.1} }} style={{ background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '32px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '${primaryColor}22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: '${primaryColor}' }}>{icons['${f.icon || 'star'}']}</div>
            <h3 style={{ color: '${textColor}', fontSize: '1.15rem', fontWeight: 600, marginBottom: '10px' }}>${f.title}</h3>
            <p style={{ color: '${textMuted}', fontSize: '0.95rem', lineHeight: 1.6 }}>${f.description}</p>
          </motion.div>`).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', textAlign: 'center', marginBottom: '56px' }}>${content.headline}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>${cards}</div>
      </section>`;
}

// content: { headline, items: [{title, description, span: 'col-2'|'row-2'|null}] }
function featuresBento(tokens, content) {
  const { textColor, textMuted, surfaceColor, borderColor, borderRadius, displayFont } = tokens;
  const cells = (content.items || []).map((f) => {
    const spanStyle = f.span === 'col-2' ? "gridColumn: 'span 2'," : f.span === 'row-2' ? "gridRow: 'span 2'," : '';
    return `
          <div style={{ ${spanStyle} background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '200px' }}>
            <h3 style={{ color: '${textColor}', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>${f.title}</h3>
            <p style={{ color: '${textMuted}', fontSize: '0.9rem' }}>${f.description}</p>
          </div>`;
  }).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', marginBottom: '48px' }}>${content.headline}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '180px', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>${cells}</div>
      </section>`;
}

// ── PRICING ──────────────────────────────────────────────────────────────
// content: { headline, tiers: [{name, price, period, features: [], highlighted, ctaLabel}] }
function pricingTiers(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderColor, borderRadius, displayFont } = tokens;
  const cards = (content.tiers || []).map((t) => {
    const border = t.highlighted ? `2px solid ${primaryColor}` : `1px solid ${borderColor}`;
    const feats = (t.features || []).map((f) => `<li style={{ color: '${textMuted}', fontSize: '0.9rem', padding: '8px 0', display: 'flex', gap: '8px' }}>✓ ${f}</li>`).join('');
    return `
          <div style={{ background: '${surfaceColor}', border: '${border}', borderRadius: '${borderRadius}', padding: '32px', flex: 1, position: 'relative' }}>
            ${t.highlighted ? `<div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '${primaryColor}', color: '#fff', fontSize: '0.75rem', fontWeight: 600, padding: '4px 14px', borderRadius: '999px' }}>Most Popular</div>` : ''}
            <h3 style={{ color: '${textColor}', fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>${t.name}</h3>
            <div style={{ marginBottom: '20px' }}><span style={{ fontSize: '2.2rem', fontWeight: 700, color: '${textColor}' }}>${t.price}</span><span style={{ color: '${textMuted}' }}>/${t.period || 'mo'}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '28px' }}>${feats}</ul>
            <a href="#pricing-cta" style={{ display: 'block', textAlign: 'center', background: '${t.highlighted ? primaryColor : 'transparent'}', border: '${t.highlighted ? 'none' : '1px solid ' + borderColor}', color: '${t.highlighted ? '#fff' : textColor}', padding: '13px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600 }}>${t.ctaLabel || 'Choose plan'}</a>
          </div>`;
  }).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', textAlign: 'center', marginBottom: '56px' }}>${content.headline}</h2>
        <div style={{ display: 'flex', gap: '24px', maxWidth: '1000px', margin: '0 auto', flexWrap: 'wrap' }}>${cards}</div>
      </section>`;
}

// ── TESTIMONIALS ─────────────────────────────────────────────────────────
// content: { headline, items: [{quote, name, role}] }
function testimonialsGrid(tokens, content) {
  const { textColor, textMuted, surfaceColor, borderColor, borderRadius, displayFont } = tokens;
  const cards = (content.items || []).map((t) => `
          <div style={{ background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '28px' }}>
            <p style={{ color: '${textColor}', fontSize: '1rem', lineHeight: 1.7, marginBottom: '20px' }}>"${t.quote}"</p>
            <div style={{ color: '${textMuted}', fontSize: '0.85rem' }}><strong style={{ color: '${textColor}' }}>${t.name}</strong> — ${t.role}</div>
          </div>`).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', textAlign: 'center', marginBottom: '56px' }}>${content.headline}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto' }}>${cards}</div>
      </section>`;
}

// content: { quote, name, role }
function testimonialSpotlight(tokens, content) {
  const { textColor, textMuted, primaryColor, displayFont } = tokens;
  return `
      <section style={{ padding: '100px 60px', textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
        <p style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.4rem, 2.8vw, 2rem)', color: '${textColor}', lineHeight: 1.5, marginBottom: '24px' }}>"${content.quote}"</p>
        <div style={{ color: '${primaryColor}', fontWeight: 600 }}>${content.name} <span style={{ color: '${textMuted}', fontWeight: 400 }}>— ${content.role}</span></div>
      </section>`;
}

// ── SOCIAL PROOF ─────────────────────────────────────────────────────────
// content: { label, logos: [names] }
function socialProofBar(tokens, content) {
  const { textMuted, borderColor } = tokens;
  const logos = (content.logos || []).map((l) => `<span style={{ color: '${textMuted}', fontWeight: 600, opacity: 0.6 }}>${l}</span>`).join('\n          ');
  return `
      <section style={{ padding: '48px 60px', borderTop: '1px solid ${borderColor}', borderBottom: '1px solid ${borderColor}' }}>
        <p style={{ textAlign: 'center', color: '${textMuted}', fontSize: '0.85rem', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>${content.label || 'Trusted by teams at'}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap' }}>
          ${logos}
        </div>
      </section>`;
}

// ── STATS ────────────────────────────────────────────────────────────────
// content: { items: [{value, label}] }
function statsCounters(tokens, content) {
  const { textMuted, primaryColor, bgColor } = tokens;
  const items = (content.items || []).map((s) => `
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: '${primaryColor}' }}>${s.value}</div><div style={{ color: '${textMuted}', fontSize: '0.95rem', marginTop: '6px' }}>${s.label}</div></div>`).join('');
  return `
      <section style={{ padding: '80px 60px', background: '${bgColor}' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '64px', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>${items}</div>
      </section>`;
}

// ── FAQ ──────────────────────────────────────────────────────────────────
// content: { headline, items: [{question, answer}] }
function faqAccordion(tokens, content) {
  const { textColor, textMuted, borderColor, displayFont } = tokens;
  const items = (content.items || []).map((f) => `
          <details style={{ borderBottom: '1px solid ${borderColor}', padding: '20px 0' }}>
            <summary style={{ color: '${textColor}', fontWeight: 600, cursor: 'pointer', fontSize: '1.05rem' }}>${f.question}</summary>
            <p style={{ color: '${textMuted}', marginTop: '12px', lineHeight: 1.7 }}>${f.answer}</p>
          </details>`).join('');
  return `
      <section style={{ padding: '100px 60px', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', marginBottom: '40px', textAlign: 'center' }}>${content.headline || 'Frequently asked questions'}</h2>
        ${items}
      </section>`;
}

// ── CTA BANNERS ──────────────────────────────────────────────────────────
// content: { headline, subtext, ctaLabel }
function ctaCentered(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderRadius, displayFont } = tokens;
  return `
      <section style={{ padding: '100px 60px', textAlign: 'center' }}>
        <div style={{ background: '${surfaceColor}', borderRadius: '${borderRadius}', padding: '64px 40px', maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: 700, color: '${textColor}', marginBottom: '16px' }}>${content.headline}</h2>
          <p style={{ color: '${textMuted}', marginBottom: '32px' }}>${content.subtext}</p>
          <a href="#final-cta" style={{ background: '${primaryColor}', color: '#fff', padding: '15px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}>${content.ctaLabel}</a>
        </div>
      </section>`;
}

// content: { headline, subtext, ctaLabel, imageAlt }
function ctaSplit(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderRadius, displayFont } = tokens;
  return `
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', background: '${surfaceColor}', borderRadius: '${borderRadius}', overflow: 'hidden', maxWidth: '1100px', margin: '0 auto 100px' }}>
        <div style={{ padding: '64px' }}>
          <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, color: '${textColor}', marginBottom: '16px' }}>${content.headline}</h2>
          <p style={{ color: '${textMuted}', marginBottom: '28px' }}>${content.subtext}</p>
          <a href="#final-cta" style={{ background: '${primaryColor}', color: '#fff', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600 }}>${content.ctaLabel}</a>
        </div>
        <div style={{ background: '${primaryColor}22' }} aria-label="${content.imageAlt || 'Visual'}" />
      </section>`;
}

// ── BANNER / ANNOUNCEMENT ────────────────────────────────────────────────
// content: { text, ctaLabel }
function announcementBanner(tokens, content) {
  const { primaryColor } = tokens;
  return `
      <div style={{ background: '${primaryColor}', color: '#fff', textAlign: 'center', padding: '10px 20px', fontSize: '0.9rem', fontWeight: 500 }}>
        ${content.text} ${content.ctaLabel ? `<a href="#banner-cta" style={{ color: '#fff', textDecoration: 'underline', marginLeft: '8px' }}>${content.ctaLabel} →</a>` : ''}
      </div>`;
}

// ── CONTACT ──────────────────────────────────────────────────────────────
// content: { headline, subtext }
function contactForm(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderColor, borderRadius, displayFont } = tokens;
  return `
      <section style={{ padding: '100px 60px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: 700, color: '${textColor}', marginBottom: '12px', textAlign: 'center' }}>${content.headline || 'Get in touch'}</h2>
        <p style={{ color: '${textMuted}', textAlign: 'center', marginBottom: '40px' }}>${content.subtext || "We'll get back to you within a day."}</p>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="text" placeholder="Name" style={{ background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '14px', color: '${textColor}' }} />
          <input type="email" placeholder="Email" style={{ background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '14px', color: '${textColor}' }} />
          <textarea placeholder="Message" rows={5} style={{ background: '${surfaceColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '14px', color: '${textColor}' }} />
          <button type="submit" style={{ background: '${primaryColor}', color: '#fff', padding: '15px', borderRadius: '${borderRadius}', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Send message</button>
        </form>
      </section>`;
}

// ── TEAM ─────────────────────────────────────────────────────────────────
// content: { headline, members: [{name, role}] }
function teamGrid(tokens, content) {
  const { textColor, textMuted, surfaceColor, borderRadius, displayFont } = tokens;
  const cards = (content.members || []).map((m) => `
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: '${surfaceColor}', borderRadius: '${borderRadius}', marginBottom: '14px' }} />
            <h4 style={{ color: '${textColor}', fontWeight: 600, marginBottom: '2px' }}>${m.name}</h4>
            <p style={{ color: '${textMuted}', fontSize: '0.9rem' }}>${m.role}</p>
          </div>`).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', textAlign: 'center', marginBottom: '56px' }}>${content.headline || 'Meet the team'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '32px', maxWidth: '900px', margin: '0 auto' }}>${cards}</div>
      </section>`;
}

// ── NEWSLETTER ───────────────────────────────────────────────────────────
// content: { headline, subtext }
function newsletterSignup(tokens, content) {
  const { textColor, textMuted, primaryColor, surfaceColor, borderColor, borderRadius, displayFont, bgColor } = tokens;
  return `
      <section style={{ padding: '80px 60px', textAlign: 'center', background: '${surfaceColor}' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: '${textColor}', marginBottom: '10px' }}>${content.headline || 'Stay in the loop'}</h2>
        <p style={{ color: '${textMuted}', marginBottom: '28px' }}>${content.subtext || 'Occasional updates, no spam.'}</p>
        <form style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
          <input type="email" placeholder="you@email.com" style={{ flex: 1, background: '${bgColor}', border: '1px solid ${borderColor}', borderRadius: '${borderRadius}', padding: '13px' }} />
          <button type="submit" style={{ background: '${primaryColor}', color: '#fff', padding: '13px 24px', borderRadius: '${borderRadius}', border: 'none', fontWeight: 600 }}>Subscribe</button>
        </form>
      </section>`;
}

// ── BLOG / ARTICLE PREVIEW ───────────────────────────────────────────────
// content: { headline, posts: [{title, excerpt, date}] }
function blogPreviewGrid(tokens, content) {
  const { textColor, textMuted, surfaceColor, borderRadius, displayFont } = tokens;
  const cards = (content.posts || []).map((p) => `
          <div>
            <div style={{ aspectRatio: '16/9', background: '${surfaceColor}', borderRadius: '${borderRadius}', marginBottom: '16px' }} />
            <p style={{ color: '${textMuted}', fontSize: '0.8rem', marginBottom: '6px' }}>${p.date}</p>
            <h3 style={{ color: '${textColor}', fontWeight: 600, fontSize: '1.1rem', marginBottom: '6px' }}>${p.title}</h3>
            <p style={{ color: '${textMuted}', fontSize: '0.9rem', lineHeight: 1.6 }}>${p.excerpt}</p>
          </div>`).join('');
  return `
      <section style={{ padding: '100px 60px' }}>
        <h2 style={{ fontFamily: "'${displayFont}', serif", fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, color: '${textColor}', marginBottom: '48px' }}>${content.headline || 'Latest articles'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>${cards}</div>
      </section>`;
}

// ── FOOTER ───────────────────────────────────────────────────────────────
// content: { brandName, columns: [{title, links: []}], copyrightName }
function footerMultiColumn(tokens, content) {
  const { textColor, textMuted, borderColor, displayFont } = tokens;
  const columns = (content.columns || []).map((c) => `
          <div>
            <h5 style={{ color: '${textColor}', fontSize: '0.85rem', fontWeight: 600, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>${c.title}</h5>
            ${(c.links || []).map((l) => `<a href="#" style={{ display: 'block', color: '${textMuted}', fontSize: '0.9rem', textDecoration: 'none', marginBottom: '10px' }}>${l}</a>`).join('\n            ')}
          </div>`).join('');
  return `
      <footer style={{ borderTop: '1px solid ${borderColor}', padding: '64px 60px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr)', gap: '40px', maxWidth: '1200px', margin: '0 auto 48px' }}>
          <span style={{ fontFamily: "'${displayFont}', sans-serif", fontSize: '1.3rem', fontWeight: 700, color: '${textColor}' }}>${content.brandName}</span>
          ${columns}
        </div>
        <p style={{ textAlign: 'center', color: '${textMuted}', fontSize: '0.85rem', borderTop: '1px solid ${borderColor}', paddingTop: '24px' }}>© {new Date().getFullYear()} ${content.copyrightName || content.brandName}. All rights reserved.</p>
      </footer>`;
}

// ── REGISTRY ─────────────────────────────────────────────────────────────

const SECTION_LIBRARY = {
  navbar_standard: navbarStandard,
  hero_centered: heroCentered,
  hero_split: heroSplit,
  about_stats: aboutSection,
  features_grid: featuresGrid,
  features_bento: featuresBento,
  pricing_tiers: pricingTiers,
  testimonials_grid: testimonialsGrid,
  testimonial_spotlight: testimonialSpotlight,
  social_proof_bar: socialProofBar,
  stats_counters: statsCounters,
  faq_accordion: faqAccordion,
  cta_centered: ctaCentered,
  cta_split: ctaSplit,
  announcement_banner: announcementBanner,
  contact_form: contactForm,
  team_grid: teamGrid,
  newsletter_signup: newsletterSignup,
  blog_preview_grid: blogPreviewGrid,
  footer_multi_column: footerMultiColumn
};

function buildSection(key, tokens, content) {
  const fn = SECTION_LIBRARY[key];
  if (!fn) throw new Error(`Unknown section key: ${key}. Available: ${Object.keys(SECTION_LIBRARY).join(', ')}`);
  return fn(tokens, content);
}

/**
 * Given a content_plan entry and a list of planned component names,
 * returns an ordered array of { key, content } objects ready for buildSection().
 *
 * @param {object} cp      - One content_plan entry from the design brief
 * @param {string[]} componentNames - plan.components[].name values for this page
 * @param {object} tokens  - resolveDesignTokens() output
 * @param {string} brandName
 */
function selectSectionsForPage(cp, componentNames = [], tokens, brandName = '') {
  const sections = [];
  const seen = new Set();

  function push(key, content) {
    if (seen.has(key)) return;
    seen.add(key);
    sections.push({ key, content });
  }

  // 1. Always start with navbar
  push('navbar_standard', {
    brandName,
    navLinks: cp.nav_links || ['Features', 'Pricing', 'About'],
    navCta: cp.section_copy_briefs?.[0]?.cta_intent || 'Get Started'
  });

  // 2. Map section_copy_briefs to library keys.
  // The design brief now outputs an explicit section_key.
  for (const brief of (cp.section_copy_briefs || [])) {
    const key = brief.section_key;
    if (key && SECTION_LIBRARY[key]) {
      push(key, brief); // pass the entire brief as content (since it matches items/tiers structure)
    } else {
      // Fallback mapping if LLM misses section_key
      const sectionName = String(brief.section || '').toLowerCase();
      const headline = brief.headline_intent || '';
      const subtext = brief.supporting_point || '';
      const cta = brief.cta_intent || '';

      if (/hero|headline|above.the.fold/i.test(sectionName)) {
        push('hero_centered', { headline, subtext, primaryCta: cta, secondaryCta: brief.secondary_cta });
      } else if (/split|visual|product.shot/i.test(sectionName)) {
        push('hero_split', { headline, subtext, primaryCta: cta, imageAlt: brief.image_alt });
      } else if (/feature|how.it.works|benefit/i.test(sectionName)) {
        push('features_grid', { headline, items: brief.items || [{title: 'Feature', description: subtext}] });
      } else if (/bento|grid.layout/i.test(sectionName)) {
        push('features_bento', { headline, items: brief.items || [] });
      } else if (/pricing|plan|tier/i.test(sectionName)) {
        push('pricing_tiers', { headline, tiers: brief.tiers || [] });
      } else if (/testimonial|review|quote/i.test(sectionName)) {
        push('testimonials_grid', { headline, items: brief.items || [] });
      } else if (/stat|number|metric|counter/i.test(sectionName)) {
        push('stats_counters', { items: brief.items || [] });
      } else if (/about|story|mission/i.test(sectionName)) {
        push('about_stats', { headline, body: subtext, stats: brief.stats || [] });
      } else if (/faq|question/i.test(sectionName)) {
        push('faq_accordion', { headline, items: brief.items || [] });
      } else if (/social.proof|partner|logo/i.test(sectionName)) {
        push('social_proof_bar', { label: headline, logos: brief.logos || [] });
      } else if (/cta|call.to.action|final|banner/i.test(sectionName)) {
        push('cta_centered', { headline, subtext, ctaLabel: cta });
      } else if (/contact|get.in.touch/i.test(sectionName)) {
        push('contact_form', { headline, subtext });
      } else if (/team|people|founders/i.test(sectionName)) {
        push('team_grid', { headline, members: brief.members || [] });
      } else if (/newsletter|subscribe|email/i.test(sectionName)) {
        push('newsletter_signup', { headline, subtext });
      } else if (/blog|article|post/i.test(sectionName)) {
        push('blog_preview_grid', { headline, posts: brief.posts || [] });
      }
    }
  }

  // 3. Always end with footer
  push('footer_multi_column', {
    brandName,
    columns: cp.footer_columns || [
      { title: 'Product', links: ['Features', 'Pricing', 'Changelog'] },
      { title: 'Company', links: ['About', 'Blog', 'Careers'] },
      { title: 'Legal', links: ['Privacy', 'Terms'] }
    ],
    copyrightName: brandName
  });

  return sections;
}

module.exports = { SECTION_LIBRARY, buildSection, selectSectionsForPage };