const { buildEngineerSupportFiles } = require('./engineer_scaffold_support');

function normalizeProjectName(value) {
  return (value || 'zaire-builder-core')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'zaire-builder-core';
}

function jsString(value) {
  return JSON.stringify(String(value ?? ''));
}

function safeDisplayText(value, fallback = '') {
  return String(value || fallback).replace(/[{}<>]/g, '').trim();
}

function normalizeBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value || '').trim().toLowerCase();
  return ['yes', 'true', '1', 'on', 'enabled', 'checked'].includes(text);
}

function inferProjectTypeLabel(projectType) {
  const labels = {
    saas: 'SaaS Platform',
    portfolio: 'Portfolio',
    agent: 'AI Agent',
    mobile: 'Mobile App',
    dashboard: 'Dashboard',
    custom: 'Custom Project'
  };

  return labels[projectType] || 'Custom Project';
}

function buildWorkflowPhases() {
  return [
    { phase: 'UNDERSTAND', purpose: 'Capture the brief and constraints before code is written.' },
    { phase: 'ARCHITECT', purpose: 'Translate the brief into scope, stack, pages, and risks.' },
    { phase: 'SCAFFOLD', purpose: 'Create the project shell, routes, and base files.' },
    { phase: 'BUILD', purpose: 'Implement the product UI and core logic.' },
    { phase: 'REVIEW', purpose: 'Check the generated work against the approved architecture.' },
    { phase: 'TEST', purpose: 'Run QA checks and identify broken or risky surfaces.' },
    { phase: 'FIX', purpose: 'Repair failing files, routes, or environment assumptions.' },
    { phase: 'PACKAGE', purpose: 'Assemble the app for handoff or deployment.' },
    { phase: 'DEPLOY', purpose: 'Verify deployment readiness and required environment values.' }
  ];
}

function buildEngineerPlan(intake = {}) {
  const projectTypeLabel = inferProjectTypeLabel(intake.projectType);
  const needsAuth = normalizeBooleanLike(intake.auth);
  const needsDatabase = normalizeBooleanLike(intake.database);
  const needsPayments = normalizeBooleanLike(intake.payments);
  const isFullStack = String(intake.scope || '').toLowerCase() === 'full-stack' || needsAuth || needsDatabase || needsPayments;
  const normalizedName = normalizeProjectName(intake.projectName);
  const appName = safeDisplayText(intake.projectName, normalizedName);
  const frontendStack = ['Next.js 14 App Router', 'TypeScript', 'Tailwind CSS'];
  const backendStack = isFullStack ? ['Route Handlers', 'Server Actions', 'Node runtime'] : ['Static app shell', 'Client fetch orchestration'];
  const dataStack = needsDatabase ? ['PostgreSQL', 'Prisma ORM'] : ['No persistent database required'];
  const authStack = needsAuth ? ['Clerk authentication', 'Protected dashboard middleware'] : ['Anonymous access or lightweight session state'];
  const paymentStack = needsPayments ? ['Stripe checkout', 'Webhook-based billing sync'] : ['No payment rails required'];
  const pages = [
    'Landing / value proposition',
    'Authenticated workspace',
    'Project detail / execution view',
    ...(needsPayments ? ['Billing / plan management'] : []),
    ...(needsAuth ? ['Sign in / sign up'] : [])
  ];
  const components = [
    'ShellFrame',
    'ProjectCommandBar',
    'MissionComposer',
    'ArchitectureSummary',
    'ExecutionTimeline',
    'CodeReviewPanel',
    ...(needsPayments ? ['BillingCard'] : []),
    ...(needsAuth ? ['AuthGate'] : []),
    ...(needsDatabase ? ['DataStatusBadge'] : [])
  ];
  const apiRoutes = isFullStack
    ? [
        'POST /api/intake',
        'POST /api/architecture/approve',
        'POST /api/build',
        ...(needsPayments ? ['POST /api/billing/create-checkout', 'POST /api/billing/webhook'] : []),
        ...(needsAuth ? ['GET /api/session'] : [])
      ]
    : ['Client-side action queue only'];
  const databaseSchema = needsDatabase
    ? [
        'users(id, email, role, created_at)',
        'projects(id, owner_id, name, summary, deployment_target)',
        'decisions(id, project_id, category, decision, rationale)',
        'build_runs(id, project_id, phase, status, created_at)',
        ...(needsPayments ? ['subscriptions(id, user_id, plan, status, stripe_customer_id)'] : [])
      ]
    : ['No relational schema required for v1'];
  const authFlow = needsAuth
    ? 'Clerk handles sign-up, session issuance, and route protection before the workspace loads.'
    : 'Public landing path with optional invite capture before entering the workspace.';
  const paymentFlow = needsPayments
    ? 'Stripe Checkout creates the subscription, webhook confirms payment, and the billing record syncs into the project workspace.'
    : 'No payment flow is required in the first release.';
  const envVars = [
    'NEXT_PUBLIC_APP_URL',
    ...(needsAuth ? ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'] : []),
    ...(needsDatabase ? ['DATABASE_URL'] : []),
    ...(needsPayments ? ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] : []),
    intake.deploymentTarget === 'Railway' ? 'RAILWAY_ENVIRONMENT' : 'VERCEL_ENV'
  ];
  const risks = [
    isFullStack ? 'Scope can grow quickly without clear page and API boundaries.' : 'Frontend-only scope may still hide future backend dependencies.',
    needsPayments ? 'Billing webhooks and subscription state need careful testing before launch.' : 'Monetization path is still undefined for later releases.',
    needsDatabase ? 'Schema drift can slow shipping if migrations are not reviewed.' : 'Lack of persistence may limit saved workflows.',
    intake.referenceSites ? 'References should guide quality, not force feature parity.' : 'Missing references may cause design ambiguity.'
  ];
  const assumptions = [
    `Primary target user remains ${intake.who || 'builders'}.`,
    intake.referenceSites ? `Reference sites are inspiration, not exact clones: ${intake.referenceSites}.` : 'No direct reference websites were provided.',
    isFullStack ? 'Server-side logic is allowed in the first release.' : 'Backend scope stays deferred unless new requirements appear.',
    `Deployment will start on ${intake.deploymentTarget || 'Vercel'}.`
  ];

  return {
    summary: `${appName} is a ${projectTypeLabel.toLowerCase()} for ${intake.who}. ZAIRE will ship it as a ${isFullStack ? 'full-stack' : 'frontend-first'} experience with ${needsAuth ? 'authentication' : 'no authentication'}, ${needsDatabase ? 'persistent data' : 'no database'}, and ${needsPayments ? 'payments enabled' : 'no payments in v1'}.`,
    stack: [...frontendStack, ...backendStack, ...dataStack, ...authStack, ...paymentStack],
    pages,
    components,
    apiRoutes,
    databaseSchema,
    authFlow,
    paymentFlow,
    envVars,
    risks,
    assumptions,
    workflowPhases: buildWorkflowPhases(),
    buildChecklist: [
      'Confirm the intake answers before generating the scaffold.',
      'Approve the architecture only after the plan matches the business goal.',
      'Create the shell and API routes before visual polish.',
      'Run review, QA, and repair passes before package/deploy.',
      'Verify required environment variables before shipping.'
    ],
    projectTypeLabel,
    normalizedName,
    appName,
    isFullStack,
    needsAuth,
    needsDatabase,
    needsPayments,
    deploymentPlan: [
      `Primary hosting target: ${intake.deploymentTarget || 'Vercel'}`,
      isFullStack ? 'Run frontend and API together in the App Router deployment.' : 'Ship a frontend-only bundle with managed API integrations later if needed.',
      needsDatabase ? 'Provision PostgreSQL and attach pooled connection settings.' : 'No database provisioning needed.',
      needsAuth ? 'Configure auth redirect URLs before launch.' : 'No auth secrets required.'
    ]
  };
}

function buildPageContent(plan, intake, appTitle, productDescription, bg, text, primary, displayFont, bodyFont, isLight, designBrief = null) {
  const pt = (intake.projectType || plan.projectTypeLabel || 'custom').toLowerCase();
  const name = safeDisplayText(intake.projectName || plan.appName, 'Project');
  const who = safeDisplayText(intake.who, 'users');
  const what = safeDisplayText(intake.what || plan.summary, '');
  const textMuted = isLight ? '#6b7280' : '#9ca3af';
  const border = isLight ? '#e5e7eb' : '#27272a';
  const surface = isLight ? '#f3f4f6' : '#111111';
  const primaryHover = isLight ? '#4f46e5' : '#c4b5fd';

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

    jsxSections += `
      {/* DYNAMIC HERO */}
      <section style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 32px 80px' }}>
        ${heroWrapperStart}
          <h1 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: '820px', marginBottom: '24px' }}>
            ${cp.core_message || appTitle}
          </h1>
          <p style={{ color: '${textMuted}', fontSize: '1.125rem', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto 48px' }}>
            ${cp.reader_state === 'warm' ? "Welcome back. Let's get to work." : productDescription}
          </p>
          <a href="#primary-cta" style={{ background: '${primary}', color: '#fff', padding: '16px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>
            Explore Now
          </a>
        ${heroWrapperEnd}
      </section>`;

    // Add Dynamic Sections
    sections.forEach((sec, idx) => {
      const bgStyle = idx % 2 === 0 ? `background: '${surface}'` : `borderTop: '1px solid ${border}'`;
      const wrapper = useFramer 
        ? "<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6, delay: 0.1 }}>"
        : "<div>";
      const endWrapper = useFramer ? "</motion.div>" : "</div>";
      const headline = sec.headline_intent || 'Important Section';
      const support = sec.supporting_point || 'More details about this section.';
      const ctaBlock = sec.cta_intent ? `
            <a href="#" style={{ border: '1px solid ${primary}', color: '${primary}', padding: '12px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 500 }}>
              ${sec.cta_intent}
            </a>` : '';

      jsxSections += `
      {/* DYNAMIC SECTION */}
      <section style={{ padding: '100px 32px', ${bgStyle} }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          ${wrapper}
            <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '24px' }}>
              ${headline}
            </h2>
            <p style={{ color: '${textMuted}', fontSize: '1.125rem', lineHeight: 1.8, maxWidth: '700px', margin: '0 auto 40px' }}>
              ${support}
            </p>${ctaBlock}
          ${endWrapper}
        </div>
      </section>`;
    });

    return `${imports}
/*
 * ==========================================
 * ZAIRE GODX DESIGN INTELLIGENCE REPORT
 * ==========================================
 * Design Rationale: ${rd}
 * Motion Rationale: ${md}
 * Structural Rationale: ${sr}
 * 
 * Adapted Features from References:
 * ${refs}
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
    <main style={{ background: '${bg}', color: '${text}', fontFamily: "'${bodyFont}', system-ui, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: scrolled ? '${isLight ? 'rgba(250,250,250,0.9)' : 'rgba(5,5,5,0.9)'}' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid ${border}' : '1px solid transparent', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
        <span style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.375rem', fontWeight: 700, color: '${primary}' }}>${name}</span>
      </nav>

      ${jsxSections}

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid ${border}', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 700, color: '${primary}' }}>${name}</span>
        <p style={{ color: '${textMuted}', fontSize: '0.875rem' }}>© {new Date().getFullYear()} ${name}. All rights reserved.</p>
      </footer>
    </main>
  );
}
`;
  }

  if (pt === 'portfolio') {
    return `'use client';
import { useState, useEffect } from 'react';

const projects = [
  { title: 'Project One', desc: 'A full-stack web application built with modern technologies.', tags: ['React', 'Node.js', 'PostgreSQL'], link: '#' },
  { title: 'Project Two', desc: 'A sleek mobile-first design system and component library.', tags: ['TypeScript', 'Tailwind', 'Figma'], link: '#' },
  { title: 'Project Three', desc: 'An AI-powered tool that automates complex workflows.', tags: ['Python', 'OpenAI', 'FastAPI'], link: '#' },
  { title: 'Project Four', desc: 'An e-commerce platform with real-time inventory and payments.', tags: ['Next.js', 'Stripe', 'Prisma'], link: '#' },
  { title: 'Project Five', desc: 'A data visualization dashboard for analytics teams.', tags: ['D3.js', 'React', 'REST API'], link: '#' },
  { title: 'Project Six', desc: 'A real-time collaboration tool with live cursors and comments.', tags: ['WebSockets', 'Redis', 'React'], link: '#' },
];

const skills = [
  { name: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
  { name: 'Backend', items: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'REST & GraphQL'] },
  { name: 'Design', items: ['Figma', 'UI/UX Design', 'Design Systems', 'Prototyping', 'Responsive Design'] },
  { name: 'DevOps', items: ['Docker', 'Vercel', 'AWS', 'CI/CD', 'Git'] },
];

export default function Page() {
  const [scrolled, setScrolled] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <main style={{ background: '${bg}', color: '${text}', fontFamily: "'${bodyFont}', system-ui, sans-serif", minHeight: '100vh' }}>
      {/* NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: scrolled ? '${isLight ? 'rgba(250,250,250,0.85)' : 'rgba(10,10,10,0.85)'}' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', borderBottom: scrolled ? '1px solid ${border}' : '1px solid transparent', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
        <a href="#" style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.5rem', fontWeight: 700, color: '${primary}', textDecoration: 'none', letterSpacing: '-0.02em' }}>${name}</a>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {['About', 'Projects', 'Skills', 'Contact'].map(link => (
            <a key={link} href={\`#\${link.toLowerCase()}\`} style={{ color: '${textMuted}', textDecoration: 'none', fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '${primary}')} onMouseLeave={e => (e.currentTarget.style.color = '${textMuted}')}>
              {link}
            </a>
          ))}
          <a href="#contact" style={{ background: '${primary}', color: '#fff', padding: '8px 20px', borderRadius: '999px', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 500, transition: 'opacity 0.2s' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Hire Me
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 32px 80px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '800px' }}>
          <p style={{ color: '${primary}', fontSize: '0.875rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '24px', fontWeight: 500 }}>Hello, World</p>
          <h1 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(3rem, 7vw, 6rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: '24px' }}>
            ${what ? what.split(' ').slice(0, 6).join(' ') : `I design and build things for the web`}
          </h1>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.75, color: '${textMuted}', maxWidth: '560px', marginBottom: '40px' }}>
            ${productDescription || `Creative developer crafting premium digital experiences. Available for freelance work.`}
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <a href="#projects" style={{ background: '${primary}', color: '#fff', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem', transition: 'transform 0.2s, opacity 0.2s' }} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              View My Work
            </a>
            <a href="#contact" style={{ border: '1px solid ${border}', color: '${text}', padding: '14px 32px', borderRadius: '999px', textDecoration: 'none', fontWeight: 500, fontSize: '0.9375rem', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '${primary}')} onMouseLeave={e => (e.currentTarget.style.borderColor = '${border}')}>
              Get In Touch
            </a>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding: '100px 32px', maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid ${border}' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <p style={{ color: '${primary}', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 600 }}>About Me</p>
            <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '24px' }}>
              Crafting Digital Experiences
            </h2>
            <p style={{ color: '${textMuted}', lineHeight: 1.8, marginBottom: '16px' }}>
              I'm a developer and designer who believes great software should be both powerful and beautiful. I specialize in building fast, accessible, and visually stunning web applications.
            </p>
            <p style={{ color: '${textMuted}', lineHeight: 1.8, marginBottom: '32px' }}>
              With a keen eye for design and a passion for clean code, I bridge the gap between design and engineering to create seamless digital products.
            </p>
            <div style={{ display: 'flex', gap: '40px' }}>
              {[['5+', 'Years Experience'], ['40+', 'Projects Done'], ['20+', 'Happy Clients']].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '2.5rem', fontWeight: 700, color: '${primary}', lineHeight: 1 }}>{val}</div>
                  <div style={{ color: '${textMuted}', fontSize: '0.875rem', marginTop: '4px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '${surface}', borderRadius: '24px', aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&auto=format&fit=crop" alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section id="projects" style={{ padding: '100px 32px', maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid ${border}' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <p style={{ color: '${primary}', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 600 }}>Selected Work</p>
          <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>Projects That Define Me</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {projects.map((project, i) => (
            <a key={i} href={project.link} style={{ background: '${surface}', borderRadius: '20px', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid ${border}', transition: 'transform 0.25s, box-shadow 0.25s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.12)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ background: \`linear-gradient(135deg, ${primary}20, ${primary}05)\`, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={\`https://images.unsplash.com/photo-\${1488590988604 + i * 100}-c29b15e1f84c?w=600&q=80&auto=format&fit=crop\`} alt={project.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              </div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>{project.title}</h3>
                <p style={{ color: '${textMuted}', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '16px' }}>{project.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {project.tags.map(tag => (
                    <span key={tag} style={{ background: '${primary}18', color: '${primary}', padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" style={{ padding: '100px 32px', maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid ${border}' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <p style={{ color: '${primary}', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 600 }}>Expertise</p>
          <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>Skills & Technologies</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
          {skills.map((cat) => (
            <div key={cat.name} style={{ background: '${surface}', borderRadius: '20px', padding: '32px', border: '1px solid ${border}' }}>
              <h3 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 600, color: '${primary}', marginBottom: '20px' }}>{cat.name}</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cat.items.map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '${textMuted}', fontSize: '0.9375rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '${primary}', flexShrink: 0 }}></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: '100px 32px', maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid ${border}' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: '${primary}', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 600 }}>Contact</p>
          <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '20px' }}>Let's Work Together</h2>
          <p style={{ color: '${textMuted}', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: '48px' }}>Have a project in mind? I'd love to hear about it. Send me a message and I'll get back to you as soon as possible.</p>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={e => e.preventDefault()}>
            <input type="text" placeholder="Your Name" style={{ background: '${surface}', border: '1px solid ${border}', borderRadius: '12px', padding: '16px 20px', color: '${text}', fontSize: '1rem', outline: 'none', width: '100%' }} />
            <input type="email" placeholder="Your Email" style={{ background: '${surface}', border: '1px solid ${border}', borderRadius: '12px', padding: '16px 20px', color: '${text}', fontSize: '1rem', outline: 'none', width: '100%' }} />
            <textarea placeholder="Tell me about your project..." rows={5} style={{ background: '${surface}', border: '1px solid ${border}', borderRadius: '12px', padding: '16px 20px', color: '${text}', fontSize: '1rem', outline: 'none', resize: 'vertical', width: '100%', fontFamily: 'inherit' }} />
            <button type="submit" style={{ background: '${primary}', color: '#fff', border: 'none', borderRadius: '999px', padding: '16px 40px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s, transform 0.2s', alignSelf: 'center' }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid ${border}', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 700, color: '${primary}' }}>${name}</span>
        <p style={{ color: '${textMuted}', fontSize: '0.875rem' }}>© {new Date().getFullYear()} ${name}. All rights reserved.</p>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['GitHub', 'LinkedIn', 'Twitter'].map(s => (
            <a key={s} href="#" style={{ color: '${textMuted}', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '${primary}')} onMouseLeave={e => (e.currentTarget.style.color = '${textMuted}')}>{s}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
`;
  }

  // Generic/SaaS fallback — also complete
  return `'use client';
import { useState, useEffect } from 'react';

const features = [
  { icon: '⚡', title: 'Lightning Fast', desc: 'Built for performance with Next.js App Router and modern infrastructure.' },
  { icon: '🎨', title: 'Beautiful Design', desc: 'Pixel-perfect UI with a premium look and feel from the ground up.' },
  { icon: '🔒', title: 'Secure by Default', desc: 'Security best practices baked in, so you can focus on building.' },
  { icon: '📱', title: 'Mobile First', desc: 'Fully responsive across all devices and screen sizes.' },
  { icon: '🔧', title: 'Easy to Customize', desc: 'Clean, well-organized code that is easy to understand and extend.' },
  { icon: '🚀', title: 'Deploy Instantly', desc: 'One-click deployment to Vercel. Go from idea to live in minutes.' },
];

export default function Page() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <main style={{ background: '${bg}', color: '${text}', fontFamily: "'${bodyFont}', system-ui, sans-serif", minHeight: '100vh' }}>
      {/* NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: scrolled ? '${isLight ? 'rgba(250,250,250,0.9)' : 'rgba(5,5,5,0.9)'}' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid ${border}' : '1px solid transparent', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
        <span style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.375rem', fontWeight: 700, color: '${primary}' }}>${name}</span>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {['Features', 'About', 'Contact'].map(link => (
            <a key={link} href={\`#\${link.toLowerCase()}\`} style={{ color: '${textMuted}', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '${primary}')} onMouseLeave={e => (e.currentTarget.style.color = '${textMuted}')}>
              {link}
            </a>
          ))}
          <a href="#contact" style={{ background: '${primary}', color: '#fff', padding: '10px 24px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>Get Started</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 32px 80px' }}>
        <div style={{ display: 'inline-block', background: '${primary}18', color: '${primary}', padding: '6px 20px', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '32px' }}>
          Now Available
        </div>
        <h1 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: '820px', marginBottom: '24px' }}>
          ${appTitle}
        </h1>
        <p style={{ color: '${textMuted}', fontSize: '1.125rem', lineHeight: 1.75, maxWidth: '560px', marginBottom: '48px' }}>
          ${productDescription}
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="#contact" style={{ background: '${primary}', color: '#fff', padding: '16px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '1rem', transition: 'transform 0.2s, opacity 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}>
            Get Started Free
          </a>
          <a href="#features" style={{ border: '1px solid ${border}', color: '${text}', padding: '16px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 500, fontSize: '1rem', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = '${primary}')} onMouseLeave={e => (e.currentTarget.style.borderColor = '${border}')}>
            Learn More
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '100px 32px', maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid ${border}' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <p style={{ color: '${primary}', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 600 }}>Features</p>
          <h2 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>Everything You Need</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: '${surface}', border: '1px solid ${border}', borderRadius: '20px', padding: '32px', transition: 'transform 0.25s, box-shadow 0.25s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: '2rem', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 600, marginBottom: '10px' }}>{f.title}</h3>
              <p style={{ color: '${textMuted}', fontSize: '0.9375rem', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid ${border}', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <span style={{ fontFamily: "'${displayFont}', Georgia, serif", fontSize: '1.25rem', fontWeight: 700, color: '${primary}' }}>${name}</span>
        <p style={{ color: '${textMuted}', fontSize: '0.875rem' }}>© {new Date().getFullYear()} ${name}. All rights reserved.</p>
      </footer>
    </main>
  );
}
`;
}

function buildEngineerScaffold(plan, intake = {}, skillLevel = 'PROFESSIONAL', designBrief = null) {
  let heroHeadline = plan.appName || plan.normalizedName || 'Project';
  let heroSubtext = intake.what || plan.summary || 'Built with precision.';

  // Resolve design tokens from designBrief or intake style
  const vt = designBrief?.visual_tokens || {};
  const designStyleStr = (intake.designStyle || '').toLowerCase();
  const isLightTheme = /light|clean|minimal|white/i.test(designStyleStr) || (plan.projectType === 'portfolio');
  const resolvedBg = vt.background_color || (isLightTheme ? '#fafafa' : '#050505');
  const resolvedText = vt.text_color || (isLightTheme ? '#18181b' : '#ffffff');
  const resolvedPrimary = vt.primary_color || (isLightTheme ? '#6366f1' : '#a78bfa');
  const resolvedDisplay = vt.typography?.display || (isLightTheme ? 'Cormorant Garamond' : 'Inter');
  const resolvedBody = vt.typography?.body || 'DM Sans';

  if (designBrief?.content_plan?.[0]) {
    const cp = designBrief.content_plan[0];
    if (cp.section_copy_briefs?.[0]?.headline_intent) {
      heroHeadline = cp.section_copy_briefs[0].headline_intent;
    }
    if (cp.core_message) {
      heroSubtext = cp.core_message;
    }
  }

  const appTitle = safeDisplayText(heroHeadline, 'ZAIRE Project');
  const productDescription = safeDisplayText(heroSubtext, 'Generated by ZAIRE Engineer Mode.');
  const metadataTitle = jsString(appTitle);
  const metadataDescription = jsString(plan.summary || productDescription);
  const files = {
    'app/layout.tsx': {
      content: `import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: ${metadataTitle},
  description: ${metadataDescription}
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      explanation: {
        what: 'This is the root layout required by the Next.js App Router.',
        why: 'Without it, the generated app cannot run as a real Next project.',
        edit: 'Metadata, providers, and global wrappers can be added here.',
        protect: 'Keep the html/body structure and children render intact.'
      }
    },
    'app/globals.css': {
      content: `@import url('https://fonts.googleapis.com/css2?family=${resolvedDisplay.replace(/ /g, '+')}:ital,wght@0,400;0,600;0,700;1,400;1,600&family=${resolvedBody.replace(/ /g, '+')}:wght@300;400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: ${resolvedBg};
  --color-text: ${resolvedText};
  --color-primary: ${resolvedPrimary};
  --font-display: '${resolvedDisplay}', Georgia, serif;
  --font-body: '${resolvedBody}', system-ui, sans-serif;
  color-scheme: ${isLightTheme ? 'light' : 'dark'};
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3 { font-family: var(--font-display); }

::selection { background: var(--color-primary); color: #fff; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-primary); border-radius: 3px; }
`,
      explanation: {
        what: 'This provides Tailwind directives and base runtime styling.',
        why: 'The generated pages use Tailwind classes and need global CSS to render correctly.',
        edit: 'Brand tokens and base styles can be refined here.',
        protect: 'Keep the Tailwind directives while Tailwind is part of the stack.'
      }
    },
    'app/page.tsx': {
      content: buildPageContent(plan, intake, appTitle, productDescription, resolvedBg, resolvedText, resolvedPrimary, resolvedDisplay, resolvedBody, isLightTheme, designBrief),
      explanation: {
        what: 'The complete landing page for the generated project.',
        why: 'Every project needs a fully built page that expresses its value immediately.',
        edit: 'Customize copy, images, and section order as needed.',
        protect: 'Keep the exported default function and core sections intact.'
      }
    },
  };

  // Pass the approved designBrief through so support files use resolved tokens
  Object.assign(files, buildEngineerSupportFiles(plan, intake, skillLevel, designBrief));

  if (plan.needsAuth) {
    files['middleware.ts'] = {
      content: `import { clerkMiddleware } from "@clerk/nextjs/server";\n\nexport default clerkMiddleware();\n\nexport const config = {\n  matcher: ["/((?!_next|.*\\\\..*).*)"]\n};\n`,
      explanation: {
        what: 'This secures application routes with auth middleware.',
        why: 'Protected screens should not render before session checks succeed.',
        edit: 'You can refine which routes are protected.',
        protect: 'Do not remove the middleware export unless you remove auth completely.'
      }
    };
  }

  if (plan.needsDatabase) {
    files['prisma/schema.prisma'] = {
      content: `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\nmodel Project {\n  id               String   @id @default(cuid())\n  name             String\n  summary          String\n  deploymentTarget String\n  createdAt        DateTime @default(now())\n}\n`,
      explanation: {
        what: 'This defines the database schema for project memory and execution records.',
        why: 'Persistent state keeps the workflow coherent between sessions.',
        edit: 'Adding fields and related models is normal as the product grows.',
        protect: 'Coordinate schema changes with migrations so data stays consistent.'
      }
    };
  }

  if (plan.isFullStack) {
    files['app/api/build/route.ts'] = {
      content: `import { NextResponse } from "next/server";\n\nexport async function POST() {\n  return NextResponse.json({\n    status: "queued",\n    phase: "${skillLevel === 'PROFESSIONAL' ? 'BUILD' : 'SCAFFOLD'}"\n  });\n}\n`,
      explanation: {
        what: 'This route receives build orchestration requests.',
        why: 'The workflow needs a backend handoff point for execution events.',
        edit: 'Response shape and orchestration details can evolve with your build system.',
        protect: 'Keep the route stable if the frontend depends on its status contract.'
      }
    };
  }

  if (plan.needsPayments) {
    files['app/api/billing/create-checkout/route.ts'] = {
      content: `import { NextResponse } from "next/server";\n\nexport async function POST() {\n  return NextResponse.json({ checkoutUrl: "https://checkout.stripe.com/session/demo" });\n}\n`,
      explanation: {
        what: 'This route creates the billing checkout handoff.',
        why: 'Payment initiation should stay server-side so secrets remain protected.',
        edit: 'Swap the demo response with the live Stripe session call.',
        protect: 'Do not expose secret keys or move checkout creation into client code.'
      }
    };
  }

  const packageConfig = {
    name: plan.normalizedName,
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint'
    },
    dependencies: {
      '@types/node': '^20.14.10',
      '@types/react': '^18.3.3',
      '@types/react-dom': '^18.3.0',
      autoprefixer: '^10.4.19',
      next: '^14.2.4',
      postcss: '^8.4.39',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      tailwindcss: '^3.4.4',
      typescript: '^5.5.3',
      ...(plan.needsAuth ? { '@clerk/nextjs': '^5.2.4' } : {}),
      ...(plan.needsDatabase ? { prisma: '^5.16.1', '@prisma/client': '^5.16.1' } : {}),
      ...(plan.needsPayments ? { stripe: '^16.2.0' } : {})
    },
    devDependencies: {}
  };
  files['next.config.mjs'] = {
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
`,
    explanation: {
      what: 'This is the Next.js runtime configuration file.',
      why: 'It lets the generated app boot with a standard Next project shape.',
      edit: 'Add image, redirect, or experimental settings here as needed.',
      protect: 'Keep it valid ESM because the file uses .mjs.'
    }
  };

  files['tailwind.config.js'] = {
    content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {}
  },
  plugins: []
};
`,
    explanation: {
      what: 'This tells Tailwind where generated UI code lives.',
      why: 'Without it, Tailwind classes will not be emitted correctly.',
      edit: 'Add brand colors, fonts, and plugins here.',
      protect: 'Keep content globs aligned with generated folders.'
    }
  };

  files['postcss.config.js'] = {
    content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
`,
    explanation: {
      what: 'This wires Tailwind into the CSS build pipeline.',
      why: 'Next uses PostCSS to process the global Tailwind CSS file.',
      edit: 'Add PostCSS plugins only when the styling system needs them.',
      protect: 'Keep tailwindcss and autoprefixer configured while Tailwind is used.'
    }
  };

  files['tsconfig.json'] = {
    content: JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2),
    explanation: {
      what: 'This is the TypeScript configuration used by Next.',
      why: 'It gives the generated TSX files a valid compiler setup.',
      edit: 'Compiler strictness and path aliases can evolve with the project.',
      protect: 'Keep Next plugin and include patterns intact.'
    }
  };

  files['next-env.d.ts'] = {
    content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated by Next.js. Do not edit manually.
`,
    explanation: {
      what: 'This provides Next.js TypeScript ambient types.',
      why: 'Next expects this file in TypeScript projects.',
      edit: 'This file should normally be left alone.',
      protect: 'Do not remove the reference directives.'
    }
  };

  files['.gitignore'] = {
    content: `.next
node_modules
.env.local
.env
.vercel
dist
`,
    explanation: {
      what: 'This keeps generated dependencies, builds, and secrets out of source control.',
      why: 'Generated projects should be safe to commit without leaking local artifacts.',
      edit: 'Add tool-specific output folders as the app grows.',
      protect: 'Keep env and dependency folders ignored.'
    }
  };

  const envExample = plan.envVars.map((item) => `${item}=`).join('\n');
  const readme = `# ${plan.appName}\n\n## What this is\n${plan.summary}\n\n## Workflow\n${(plan.workflowPhases || []).map((item) => `- ${item.phase}: ${item.purpose}`).join('\n')}\n\n## Stack\n${plan.stack.map((item) => `- ${item}`).join('\n')}\n\n## Pages\n${plan.pages.map((item) => `- ${item}`).join('\n')}\n\n## Next steps\n${(plan.buildChecklist || []).map((item) => `- ${item}`).join('\n')}\n`;

  return {
    fileTree: Object.keys(files),
    files,
    readme,
    envExample,
    packageConfig
  };
}

function buildGenerationPrompts(brief, plan, intake, profile, dnaKey) {
  let heroHeadline = plan.appName || intake.projectName || 'Project';
  let heroSubtext = intake.what || plan.summary || '';
  
  try {
    const briefObj = JSON.parse(brief.replace('DESIGN BRIEF:\n', ''));
    if (briefObj?.content_plan?.[0]) {
      const cp = briefObj.content_plan[0];
      if (cp.section_copy_briefs?.[0]?.headline_intent) heroHeadline = cp.section_copy_briefs[0].headline_intent;
      if (cp.core_message) heroSubtext = cp.core_message;
    }
  } catch (e) {
    // Ignore parse errors, fallback to raw intake
  }

  const BASE_SYSTEM = `You are ZAIRE — an elite senior UI/UX engineer and world-class designer.
You produce premium, human-crafted website code that no other AI can replicate.
Your output is always pure code — NEVER markdown fences, NEVER explanatory text before or after the code.
Every file you generate must feel like it was crafted by a senior designer at a world-class studio.
You strictly follow the Design Brief and DNA Profile provided. You NEVER default to generic output.`;

  return {
    globalsCss: {
      system: BASE_SYSTEM + `
You are generating globals.css.
Rules:
- Output ONLY raw CSS. No markdown, no explanation text.
- Define all CSS custom properties (variables) based on the exact palette and typography from the brief.
- Include: CSS reset, body styles, custom scrollbar, ::selection, .container utility, Google Fonts @import.
- Use real Google Fonts that match the DNA typography.
- The result must feel like a premium design system, not a generic reset.`,
      user: `${brief}\n\nGenerate globals.css now. Output ONLY the CSS code, starting with @import or :root.`
    },
    tailwindConfig: {
      system: BASE_SYSTEM + `
You are generating tailwind.config.ts.
Rules:
- Output ONLY valid TypeScript. No markdown, no explanation.
- Use \`type { Config } from 'tailwindcss'\`.
- Extend theme with: custom colors (from the DNA palette), custom fontFamily (from DNA typography), custom keyframes and animation (fadeUp, fadeIn, gradient-shift), custom screens (xs: 375px).
- Do not use placeholder values — all colors must be real hex values from the design brief.
- Use \`require('@tailwindcss/typography')\` and \`require('@tailwindcss/forms')\` in plugins array.`,
      user: `${brief}\n\nGenerate tailwind.config.ts now. Output ONLY the TypeScript code.`
    },
    layoutTsx: {
      system: BASE_SYSTEM + `
You are generating app/layout.tsx for Next.js 14 App Router.
Rules:
- Output ONLY valid TypeScript JSX. No markdown, no explanation.
- Import the Google Fonts that match the DNA (use 'next/font/google').
- Include complete OpenGraph and Twitter card metadata.
- The body tag must apply the font variable classes.
- Include a <link rel="preconnect"> to fonts.googleapis.com.
- Include './globals.css' import.
- The layout must use \`suppressHydrationWarning\` on the html tag.`,
      user: `${brief}\n\nApp Name: ${heroHeadline}\nDescription: ${heroSubtext}\nDeployment URL: https://${(plan.appName || intake.projectName || 'project').toLowerCase().replace(/ /g, '-')}.vercel.app\n\nGenerate app/layout.tsx now. Output ONLY the code starting with imports.`
    },
    pageTsx: {
      system: BASE_SYSTEM + `
You are generating app/page.tsx — the full landing page of the website.
This is the most important file. It must be STUNNING and feel like a world-class design studio built it.

CRITICAL RULES:
- Output ONLY valid TSX code. No markdown fences. No text before or after. Start with 'use client'; or imports.
- Use Tailwind CSS classes exclusively for styling. Inline styles only for CSS variables.
- Write ALL copy contextually — based on the app name, description, and target user. NEVER lorem ipsum.
- Include a complete, functional Navbar with logo and navigation links.
- Include ALL sections in this order: ${(profile.sections_order || ['Navbar', 'Hero', 'Features', 'Testimonials', 'Pricing', 'FAQ', 'Footer']).join(', ')}
- Every section must be fully implemented — no placeholder comments like "// add content here".
- Use real data — fake but believable testimonials, feature descriptions, pricing tiers (if SaaS).
- Apply all DNA rules: spacing, border-radius, animation easing, hover states.
- Every button must have hover and focus states.
- Images: use placeholder images via \`https://images.unsplash.com\` with relevant search terms.
- The page must be mobile responsive (use Tailwind responsive classes: sm:, md:, lg:).

DNA AESTHETIC: ${dnaKey}
Hero Pattern: ${profile.hero_pattern || ''}
Layout Pattern: ${profile.layout_pattern || ''}`,
      user: `${brief}\n\nApp Name: ${heroHeadline}\nDescription: ${heroSubtext}\nTarget User: ${intake.who || 'professionals'}\n\nGenerate the complete app/page.tsx now. Output ONLY the code.`
    },
    selfReview: {
      system: BASE_SYSTEM + `
You are performing a quality review of generated code.
Review the provided app/page.tsx against the Anti-Patterns listed in the brief.
If you find ANY of these issues:
  - Lorem ipsum text
  - Equal-sized feature card grid (all cards same size)
  - Missing hover states on buttons
  - Hardcoded secrets
  - No mobile responsiveness
  - Less than 5 complete sections

Fix them and return the COMPLETE corrected file.
If no issues are found, return the file unchanged.
Output ONLY the raw TSX code. No markdown, no explanation.`,
      user: (pageContent) => `${brief}\n\nCURRENT app/page.tsx:\n${pageContent.substring(0, 4000)}\n\nReview and return the corrected (or unchanged) complete file.`
    }
  };
}

/**
 * Builds an LLM prompt pair for generating an incremental architecture update.
 * @param {Object} existingPlan - The current parsed architecture plan
 * @param {string} featureRequest - The user's new feature request text
 * @returns {{system: string, user: string}}
 */
function buildIncrementalPlan(existingPlan, featureRequest) {
  const systemPrompt = `You are an expert AI software architect.
Your task is to analyze an existing project's architecture plan and a new feature request, and produce an INCREMENTAL update to the architecture.

Return ONLY a JSON object with the following structure (no markdown fences, no explanations):
{
  "newFiles": [
    { "path": "app/new-feature/page.tsx", "purpose": "Description of what this does" }
  ],
  "modifiedFiles": [
    { "path": "app/layout.tsx", "purpose": "Added link to new feature" }
  ],
  "removedFiles": [],
  "changedComponents": [
    { "name": "Database", "change": "Added new table for feature" }
  ],
  "updatedSummary": "A brief summary of how the architecture changed."
}
Make sure your JSON is strictly valid and parseable.`;

  const userPrompt = `EXISTING ARCHITECTURE PLAN:
${JSON.stringify(existingPlan, null, 2)}

NEW FEATURE REQUEST:
${featureRequest}

Generate the JSON changeset detailing the architectural modifications required to implement this feature.`;

  return { system: systemPrompt, user: userPrompt };
}

function buildArchitecturePrompts(intake) {
  const systemPrompt = `You are an expert AI software architect.
Your task is to generate a dynamic architecture plan for a new project based on the user's intake answers.
Return ONLY a JSON object with the following structure (no markdown fences, no explanations):
{
  "pages": ["List of page routes or descriptions", "e.g. Landing / value proposition", "e.g. User Dashboard"],
  "components": ["List of React component names to build", "e.g. HeroSection", "e.g. PricingCard"],
  "apiRoutes": ["List of backend routes", "e.g. POST /api/signup"],
  "databaseSchema": ["List of tables and columns", "e.g. users(id, email)"],
  "risks": ["List of architectural risks"],
  "assumptions": ["List of assumptions made"]
}
Ensure your output is strictly valid and parseable JSON.`;

  const userPrompt = `PROJECT INTAKE:
${JSON.stringify(intake, null, 2)}

Generate the JSON architecture plan tailored to this specific project requirements.`;

  return { system: systemPrompt, user: userPrompt };
}

module.exports = {
  buildEngineerPlan,
  buildEngineerScaffold,
  buildGenerationPrompts,
  buildIncrementalPlan,
  buildArchitecturePrompts
};

