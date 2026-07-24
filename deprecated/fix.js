const fs = require('fs');

const signatureTarget = 'function buildPageContent(plan, intake, appTitle, productDescription, bg, text, primary, displayFont, bodyFont, isLight) {';
const signatureReplacement = 'function buildPageContent(plan, intake, appTitle, productDescription, bg, text, primary, displayFont, bodyFont, isLight, designBrief = null) {';

const callTarget = 'content: buildPageContent(plan, intake, appTitle, productDescription, resolvedBg, resolvedText, resolvedPrimary, resolvedDisplay, resolvedBody, isLightTheme),';
const callReplacement = 'content: buildPageContent(plan, intake, appTitle, productDescription, resolvedBg, resolvedText, resolvedPrimary, resolvedDisplay, resolvedBody, isLightTheme, designBrief),';

const injectTarget = "const primaryHover = isLight ? '#4f46e5' : '#c4b5fd';";

const godxBlock = `
  // --- GODX DYNAMIC GENERATION ---
  if (designBrief && designBrief.content_plan && designBrief.content_plan.length > 0 && designBrief.content_plan[0].section_copy_briefs) {
    const cp = designBrief.content_plan[0];
    const sections = cp.section_copy_briefs || [];
    const motion = designBrief.motion_spec || {};
    const useFramer = motion.level && motion.level !== 'minimal';

    let imports = "'use client';\\nimport { useState, useEffect } from 'react';\\n";
    if (useFramer) {
      imports += "import { motion } from 'framer-motion';\\n";
    }

    const rd = designBrief.design_rationale || 'Resolved based on target audience.';
    const md = motion.rationale || 'Standard UX patterns.';
    const sr = designBrief.page_architecture?.rationale || 'Linear conversion flow.';
    const refs = designBrief.reference_extractions ? designBrief.reference_extractions.map(r => '- ' + r.feature + ': ' + r.adaptation).join('\\n * ') : 'None extracted.';

    let jsxSections = '';
    
    // Always add Hero first
    const heroWrapperStart = useFramer ? "<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>" : "<div>";
    const heroWrapperEnd = useFramer ? "</motion.div>" : "</div>";

    jsxSections += \`
      {/* DYNAMIC HERO */}
      <section style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 32px 80px' }}>
        \${heroWrapperStart}
          <h1 style={{ fontFamily: "'\${displayFont}', Georgia, serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: '820px', marginBottom: '24px' }}>
            \${cp.core_message || appTitle}
          </h1>
          <p style={{ color: '\${textMuted}', fontSize: '1.125rem', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto 48px' }}>
            \${cp.reader_state === 'warm' ? "Welcome back. Let's get to work." : productDescription}
          </p>
          <a href="#primary-cta" style={{ background: '\${primary}', color: '#fff', padding: '16px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>
            Explore Now
          </a>
        \${heroWrapperEnd}
      </section>\`;

    // Add Dynamic Sections
    sections.forEach((sec, idx) => {
      const bgStyle = idx % 2 === 0 ? \`background: '\${surface}'\` : \`borderTop: '1px solid \${border}'\`;
      const wrapper = useFramer 
        ? "<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6, delay: 0.1 }}>"
        : "<div>";
      const endWrapper = useFramer ? "</motion.div>" : "</div>";
      const headline = sec.headline_intent || 'Important Section';
      const support = sec.supporting_point || 'More details about this section.';
      const ctaBlock = sec.cta_intent ? \`
            <a href="#" style={{ border: '1px solid \${primary}', color: '\${primary}', padding: '12px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 500 }}>
              \${sec.cta_intent}
            </a>\` : '';

      jsxSections += \`
      {/* DYNAMIC SECTION */}
      <section style={{ padding: '100px 32px', \${bgStyle} }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          \${wrapper}
            <h2 style={{ fontFamily: "'\${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '24px' }}>
              \${headline}
            </h2>
            <p style={{ color: '\${textMuted}', fontSize: '1.125rem', lineHeight: 1.8, maxWidth: '700px', margin: '0 auto 40px' }}>
              \${support}
            </p>\${ctaBlock}
          \${endWrapper}
        </div>
      </section>\`;
    });

    return \`\${imports}
/*
 * Design Rationale: \${rd}
 * Motion Rationale: \${md}
 * Structural Rationale: \${sr}
 * 
 * Adapted Features from References:
 * \${refs}
 * ==========================================
 */
export default function Page() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <main style={{ background: '\${bg}', color: '\${text}', fontFamily: "'\${bodyFont}', system-ui, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: scrolled ? '\${isLight ? 'rgba(250,250,250,0.9)' : 'rgba(5,5,5,0.9)'}' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid \${border}' : '1px solid transparent', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
        <span style={{ fontFamily: "'\${displayFont}', Georgia, serif", fontSize: '1.375rem', fontWeight: 700, color: '\${primary}' }}>\${name}</span>
      </nav>

      \${jsxSections}

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid \${border}', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontFamily: "'\${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 700, color: '\${primary}' }}>\${name}</span>
        <p style={{ color: '\${textMuted}', fontSize: '0.875rem' }}>© {new Date().getFullYear()} \${name}. All rights reserved.</p>
      </footer>
    </main>
  );
}
\`;
  }
`;

let data = fs.readFileSync('services/engineer_workflow.js', 'utf8');
data = data.replace(signatureTarget, signatureReplacement);
data = data.replace(callTarget, callReplacement);
data = data.replace(injectTarget, injectTarget + "\\n" + godxBlock);
fs.writeFileSync('services/engineer_workflow.js', data);
