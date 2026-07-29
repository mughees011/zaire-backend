/**
 * ZAIRE Section Component Library (EXTRAORDINARY EDITION)
 *
 * This version replaces basic inline styles with stunning Tailwind CSS utilities,
 * Framer Motion micro-animations, glassmorphism, and gradient text.
 * All dynamic colors from the design brief are injected using Tailwind's
 * arbitrary values syntax (e.g., bg-[${bgColor}]).
 */

// ── NAVBAR ───────────────────────────────────────────────────────────────

function navbarStandard(tokens, content) {
  const { bgColor, textColor = '#fff', displayFont, primaryColor, borderColor } = tokens;
  const links = content.links.map(l => `<a href="${l.href}" className="text-[${textColor}]/70 hover:text-[${primaryColor}] transition-colors duration-300 text-sm font-medium">${l.label}</a>`).join('\n          ');
  return `
      <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[${bgColor}]/80 border-b border-[${borderColor}]/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="font-display text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[${textColor}] to-[${primaryColor}]" style={{ fontFamily: "'${displayFont}', sans-serif" }}>
            ${content.logoText}
          </span>
          <div className="hidden md:flex items-center gap-8">
            ${links}
            <a href="${content.ctaHref || '#'}" className="bg-[${primaryColor}] text-white px-6 py-2.5 rounded-full font-medium text-sm hover:shadow-[0_0_20px_${primaryColor}66] hover:scale-105 transition-all duration-300">
              ${content.ctaLabel || 'Get Started'}
            </a>
          </div>
          <button className="md:hidden text-[${textColor}]">
            <Menu size={24} />
          </button>
        </div>
      </nav>`;
}

// ── HERO (2 variants) ───────────────────────────────────────────────────

function heroCentered(tokens, content) {
  const { bgColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', primaryColor, displayFont, bodyFont } = tokens;
  return `
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-[${bgColor}]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[${primaryColor}]/20 via-[${bgColor}] to-[${bgColor}]"></div>
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}
            className="inline-block mb-6 px-4 py-1.5 rounded-full border border-[${primaryColor}]/30 bg-[${primaryColor}]/10 backdrop-blur-md text-[${primaryColor}] text-sm font-semibold tracking-wide uppercase"
          >
            Introducing ZAIRE Mode
          </motion.div>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight text-[${textColor}] leading-tight mb-8" style={{ fontFamily: "'${displayFont}', serif" }}>
            ${content.headline}
          </h1>
          <p className="text-xl md:text-2xl text-[${textMuted}] max-w-2xl mx-auto mb-10 leading-relaxed font-light" style={{ fontFamily: "'${bodyFont}', sans-serif" }}>
            ${content.subtext}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="${content.ctaHref || '#'}" className="w-full sm:w-auto bg-[${primaryColor}] text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-[0_0_30px_${primaryColor}80] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2">
              ${content.ctaLabel} <ArrowRight size={20} />
            </a>
            <a href="#demo" className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-lg text-[${textColor}] bg-white/5 border border-[${textColor}]/10 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm">
              Watch Demo
            </a>
          </div>
        </motion.div>
      </section>`;
}

function heroSplit(tokens, content) {
  const { bgColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', primaryColor, displayFont, bodyFont, surfaceColor } = tokens;
  return `
      <section className="relative min-h-[90vh] flex items-center px-6 overflow-hidden bg-[${bgColor}]">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-[${primaryColor}]/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center relative z-10 py-20">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[${textColor}] leading-[1.1] mb-6" style={{ fontFamily: "'${displayFont}', serif" }}>
              ${content.headline}
            </h1>
            <p className="text-lg md:text-xl text-[${textMuted}] mb-10 leading-relaxed max-w-lg" style={{ fontFamily: "'${bodyFont}', sans-serif" }}>
              ${content.subtext}
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="${content.ctaHref || '#'}" className="bg-[${primaryColor}] text-white px-8 py-4 rounded-full font-semibold hover:shadow-[0_8px_30px_${primaryColor}66] hover:-translate-y-1 transition-all duration-300">
                ${content.ctaLabel}
              </a>
              <a href="#features" className="px-8 py-4 rounded-full font-semibold text-[${textColor}] border border-[${textColor}]/20 hover:bg-[${textColor}]/5 transition-all duration-300 flex items-center gap-2">
                <Play size={18} /> See it in action
              </a>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9, rotateY: 10 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: 1, delay: 0.2 }} className="relative perspective-1000">
            <div className="aspect-square md:aspect-[4/3] bg-gradient-to-tr from-[${surfaceColor}] to-[${bgColor}] border border-[${primaryColor}]/20 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl flex items-center justify-center group">
              <div className="absolute inset-0 bg-[${primaryColor}]/5 group-hover:bg-[${primaryColor}]/10 transition-colors duration-500"></div>
              <div className="w-24 h-24 rounded-2xl bg-[${primaryColor}]/20 flex items-center justify-center animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[${primaryColor}]/40 blur-sm"></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>`;
}

// ── ABOUT ────────────────────────────────────────────────────────────────

function aboutStandard(tokens, content) {
  const { bgColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', displayFont, bodyFont } = tokens;
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-display text-4xl md:text-5xl font-bold text-[${textColor}] mb-8" style={{ fontFamily: "'${displayFont}', serif" }}>
            ${content.heading}
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-xl text-[${textMuted}] leading-relaxed" style={{ fontFamily: "'${bodyFont}', sans-serif" }}>
            ${content.body}
          </motion.p>
        </div>
      </section>`;
}

// ── FEATURES / SERVICES ──────────────────────────────────────────────────

function featuresGrid(tokens, content) {
  const { bgColor, surfaceColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', primaryColor, displayFont, bodyFont, borderColor } = tokens;
  const cards = content.items.map((item, i) => `
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ delay: ${i} * 0.1, duration: 0.5 }} 
            className="group relative bg-[${surfaceColor}]/50 backdrop-blur-md border border-[${borderColor}] rounded-3xl p-8 hover:bg-[${surfaceColor}] hover:border-[${primaryColor}]/50 hover:shadow-2xl hover:shadow-[${primaryColor}]/10 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[${primaryColor}]/5 rounded-full blur-3xl group-hover:bg-[${primaryColor}]/20 transition-colors duration-500"></div>
            <div className="w-14 h-14 bg-[${primaryColor}]/10 rounded-2xl flex items-center justify-center text-[${primaryColor}] text-2xl mb-6 group-hover:scale-110 transition-transform duration-500">
              ${item.icon || '<Star size={24} />'}
            </div>
            <h3 className="font-display text-2xl font-bold text-[${textColor}] mb-4" style={{ fontFamily: "'${displayFont}', serif" }}>${item.title}</h3>
            <p className="text-[${textMuted}] leading-relaxed" style={{ fontFamily: "'${bodyFont}', sans-serif" }}>${item.description}</p>
          </motion.div>`).join('\n');
  return `
      <section className="py-32 px-6 bg-[${bgColor}] relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[${textColor}] tracking-tight mb-6" style={{ fontFamily: "'${displayFont}', serif" }}>${content.heading}</h2>
            <div className="w-24 h-1 bg-[${primaryColor}] mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${cards}
          </div>
        </div>
      </section>`;
}

// ── PRICING ──────────────────────────────────────────────────────────────

function pricingTiers(tokens, content) {
  const { bgColor, surfaceColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', primaryColor, displayFont, borderColor } = tokens;
  const tiers = content.tiers.map((tier, i) => `
          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ${i} * 0.15 }}
            className="relative flex flex-col bg-[${tier.highlighted ? surfaceColor : 'transparent'}] border border-[${tier.highlighted ? primaryColor : borderColor}] rounded-3xl p-8 ${tier.highlighted ? 'md:-translate-y-4 shadow-2xl shadow-[' + primaryColor + ']/20 scale-105 z-10' : 'hover:border-[' + textColor + ']/30'} transition-all duration-300"
          >
            ${tier.highlighted ? `<div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[${primaryColor}] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">Most Popular</div>` : ''}
            <h3 className="text-xl font-medium text-[${tier.highlighted ? textColor : textMuted}] mb-2">${tier.name}</h3>
            <div className="font-display text-5xl font-bold text-[${textColor}] mb-8" style={{ fontFamily: "'${displayFont}', serif" }}>
              ${tier.price} <span className="text-lg text-[${textMuted}] font-normal">/mo</span>
            </div>
            <ul className="flex-1 space-y-4 mb-8">
              ${(tier.features || []).map(f => `
                <li className="flex items-start gap-3 text-[${tier.highlighted ? textColor : textMuted}]">
                  <Check size={20} className="text-[${primaryColor}] shrink-0" />
                  <span>${f}</span>
                </li>
              `).join('')}
            </ul>
            <a href="#" className="block w-full text-center py-4 rounded-xl font-bold transition-all duration-300 ${tier.highlighted ? `bg-[${primaryColor}] text-white hover:shadow-[0_0_20px_${primaryColor}66] hover:scale-[1.02]` : `bg-[${surfaceColor}] text-[${textColor}] hover:bg-[${textColor}]/10 hover:scale-[1.02]`}">
              Choose ${tier.name}
            </a>
          </motion.div>`).join('\n');
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[${textColor}] mb-6" style={{ fontFamily: "'${displayFont}', serif" }}>Simple, transparent pricing</h2>
            <p className="text-[${textMuted}] text-xl max-w-2xl mx-auto">Choose the plan that fits your needs.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            ${tiers}
          </div>
        </div>
      </section>`;
}

// ── TESTIMONIALS ─────────────────────────────────────────────────────────

function testimonialsGrid(tokens, content) {
  const { bgColor, surfaceColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', displayFont, borderColor } = tokens;
  const cards = content.items.map((t, i) => `
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: ${i} * 0.1 }} className="bg-[${surfaceColor}] border border-[${borderColor}] rounded-3xl p-8 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div>
              <div className="flex gap-1 text-yellow-500 mb-6">
                {[1,2,3,4,5].map(star => <Star key={star} size={16} fill="currentColor" />)}
              </div>
              <p className="text-[${textColor}] text-lg leading-relaxed mb-8 italic">"${t.quote}"</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[${borderColor}] to-[${surfaceColor}] border border-[${borderColor}]"></div>
              <div>
                <div className="font-bold text-[${textColor}]">${t.author}</div>
                <div className="text-sm text-[${textMuted}]">${t.role || 'Customer'}</div>
              </div>
            </div>
          </motion.div>`).join('\n');
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-[${textColor}] text-center mb-20" style={{ fontFamily: "'${displayFont}', serif" }}>Don't just take our word for it</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${cards}
          </div>
        </div>
      </section>`;
}

// ── SOCIAL PROOF ─────────────────────────────────────────────────────────

function socialProofStrip(tokens, content) {
  const { bgColor, textMuted = 'rgba(255,255,255,0.4)' } = tokens;
  const logos = content.logos.map(name => `<div className="flex items-center justify-center text-[${textMuted}] hover:text-[${textMuted}]/80 transition-colors grayscale opacity-60 hover:grayscale-0 hover:opacity-100 font-bold text-2xl tracking-tighter cursor-pointer">${name}</div>`).join('\n          ');
  return `
      <section className="py-12 border-y border-[${textMuted}]/10 bg-[${bgColor}] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-medium text-[${textMuted}] mb-8 uppercase tracking-widest">Trusted by innovative teams worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8">
            ${logos}
          </div>
        </div>
      </section>`;
}

// ── STATS BANNER ─────────────────────────────────────────────────────────

function statsBanner(tokens, content) {
  const { primaryColor, textMuted = 'rgba(255,255,255,0.6)', displayFont, surfaceColor, bgColor } = tokens;
  const stats = content.items.map((s, i) => `
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: ${i} * 0.1 }} className="text-center">
            <div className="font-display text-5xl md:text-6xl font-black text-[${primaryColor}] mb-2 bg-clip-text text-transparent bg-gradient-to-b from-[${primaryColor}] to-[${primaryColor}]/70" style={{ fontFamily: "'${displayFont}', serif" }}>${s.value}</div>
            <div className="text-[${textMuted}] font-medium text-lg">${s.label}</div>
          </motion.div>`).join('\n');
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-5xl mx-auto bg-[${surfaceColor}]/50 backdrop-blur-xl border border-[${primaryColor}]/10 rounded-3xl p-16 shadow-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            ${stats}
          </div>
        </div>
      </section>`;
}

// ── CALL TO ACTION BANNER ────────────────────────────────────────────────

function ctaBanner(tokens, content) {
  const { primaryColor, displayFont, bodyFont, bgColor } = tokens;
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[3rem] bg-[${primaryColor}] text-white px-6 py-24 text-center shadow-2xl shadow-[${primaryColor}]/20">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight" style={{ fontFamily: "'${displayFont}', serif" }}>${content.heading}</h2>
            <p className="text-xl text-white/80 mb-10 leading-relaxed font-light" style={{ fontFamily: "'${bodyFont}', sans-serif" }}>${content.subtext}</p>
            <a href="${content.ctaHref || '#'}" className="inline-flex items-center justify-center gap-2 bg-white text-[${primaryColor}] px-10 py-4 rounded-full font-bold text-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
              ${content.ctaLabel} <ArrowUpRight size={20} />
            </a>
          </motion.div>
        </div>
      </section>`;
}

// ── CONTACT ──────────────────────────────────────────────────────────────

function contactSplit(tokens, content) {
  const { bgColor, surfaceColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.6)', primaryColor, displayFont, borderColor } = tokens;
  return `
      <section className="py-32 px-6 bg-[${bgColor}]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-5xl font-bold text-[${textColor}] mb-6" style={{ fontFamily: "'${displayFont}', serif" }}>${content.heading}</h2>
            <p className="text-xl text-[${textMuted}] mb-8 leading-relaxed">${content.subtext || 'Get in touch with us to learn more.'}</p>
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-[${textColor}]"><div className="w-12 h-12 rounded-full bg-[${surfaceColor}] flex items-center justify-center"><Check size={20} className="text-[${primaryColor}]" /></div> <span>24/7 Priority Support</span></div>
              <div className="flex items-center gap-4 text-[${textColor}]"><div className="w-12 h-12 rounded-full bg-[${surfaceColor}] flex items-center justify-center"><Check size={20} className="text-[${primaryColor}]" /></div> <span>Enterprise-grade security</span></div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[${surfaceColor}]/50 backdrop-blur-xl border border-[${borderColor}] rounded-3xl p-10 shadow-2xl">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-sm font-medium text-[${textMuted}]">First Name</label><input type="text" className="w-full bg-transparent border border-[${borderColor}] rounded-xl p-4 text-[${textColor}] focus:outline-none focus:border-[${primaryColor}] focus:ring-1 focus:ring-[${primaryColor}] transition-all" /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-[${textMuted}]">Last Name</label><input type="text" className="w-full bg-transparent border border-[${borderColor}] rounded-xl p-4 text-[${textColor}] focus:outline-none focus:border-[${primaryColor}] focus:ring-1 focus:ring-[${primaryColor}] transition-all" /></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium text-[${textMuted}]">Work Email</label><input type="email" className="w-full bg-transparent border border-[${borderColor}] rounded-xl p-4 text-[${textColor}] focus:outline-none focus:border-[${primaryColor}] focus:ring-1 focus:ring-[${primaryColor}] transition-all" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-[${textMuted}]">Message</label><textarea rows={4} className="w-full bg-transparent border border-[${borderColor}] rounded-xl p-4 text-[${textColor}] focus:outline-none focus:border-[${primaryColor}] focus:ring-1 focus:ring-[${primaryColor}] transition-all"></textarea></div>
              <button type="submit" className="w-full bg-[${primaryColor}] text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_${primaryColor}66] hover:-translate-y-1 transition-all duration-300">${content.submitLabel || 'Send Message'}</button>
            </form>
          </motion.div>
        </div>
      </section>`;
}

// ── FOOTER ───────────────────────────────────────────────────────────────

function footerStandard(tokens, content) {
  const { bgColor, surfaceColor, textColor = '#fff', textMuted = 'rgba(255,255,255,0.5)', borderColor, displayFont, primaryColor } = tokens;
  const links = (content.links || []).map(l => `<a href="${l.href}" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">${l.label}</a>`).join('\n              ');
  return `
      <footer className="bg-[${bgColor}] border-t border-[${borderColor}] pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <span className="font-display text-2xl font-bold text-[${textColor}] mb-4 block" style={{ fontFamily: "'${displayFont}', serif" }}>${content.logoText}</span>
              <p className="text-[${textMuted}] text-sm leading-relaxed mb-6">Building the future of digital experiences with state-of-the-art AI technology.</p>
              <div className="flex gap-4 text-[${textMuted}]">
                <a href="#" className="hover:text-[${primaryColor}] transition-colors"><Twitter size={20} /></a>
                <a href="#" className="hover:text-[${primaryColor}] transition-colors"><Github size={20} /></a>
                <a href="#" className="hover:text-[${primaryColor}] transition-colors"><Linkedin size={20} /></a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-[${textColor}] mb-6">Product</h4>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Features</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Integrations</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Pricing</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Changelog</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-[${textColor}] mb-6">Company</h4>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">About Us</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Careers</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Blog</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-[${textColor}] mb-6">Legal</h4>
              <div className="flex flex-col gap-3">
                ${links}
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Privacy Policy</a>
                <a href="#" className="text-[${textMuted}] hover:text-[${primaryColor}] transition-colors text-sm">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="border-t border-[${borderColor}] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[${textMuted}] text-sm">© {new Date().getFullYear()} ${content.logoText}. All rights reserved.</p>
            <div className="flex items-center gap-2 text-sm text-[${textMuted}]">
              <span>Designed with</span> <Star size={14} className="text-[${primaryColor}] fill-current" /> <span>by ZAIRE</span>
            </div>
          </div>
        </div>
      </footer>`;
}

// ── REGISTRY ─────────────────────────────────────────────────────────────

const COMPONENT_LIBRARY = {
  navbar: { standard: navbarStandard },
  hero: { centered: heroCentered, split: heroSplit },
  about: { standard: aboutStandard },
  features: { grid: featuresGrid },
  pricing: { tiers: pricingTiers },
  testimonials: { grid: testimonialsGrid },
  social_proof: { strip: socialProofStrip },
  stats: { banner: statsBanner },
  cta: { banner: ctaBanner },
  contact: { split: contactSplit },
  footer: { standard: footerStandard }
};

function renderSection(type, variant, tokens, content) {
  const entry = COMPONENT_LIBRARY[type]?.[variant];
  if (!entry) throw new Error(\`No component registered for \${type}/\${variant} — extend COMPONENT_LIBRARY instead of freehanding this section.\`);
  return entry(tokens, content);
}

module.exports = { COMPONENT_LIBRARY, renderSection };