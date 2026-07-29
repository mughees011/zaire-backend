const { buildEngineerSupportFiles } = require('./engineer_scaffold_support');
const { selectDnaKey, buildDnaSystemBlock, buildProfileObject } = require('./design_dna');
const { selectEffects } = require('./design_dna_extended');
const { planFrontend } = require('./agents/frontend_agent');
const { planBackend } = require('./agents/backend_agent');
const { planDevOps } = require('./agents/devops_agent');
const memoryAgent = require('./agents/memory_agent');

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

function buildEngineerPlan(intake = {}, visionData = null, contextBlock = null) {
  const needsAuth = normalizeBooleanLike(intake.auth);
  const needsDatabase = normalizeBooleanLike(intake.database);
  const needsPayments = normalizeBooleanLike(intake.payments);
  const isFullStack = String(intake.scope || '').toLowerCase() === 'full-stack' || needsAuth || needsDatabase || needsPayments;

  // 1. Frontend Agent
  const frontendPlan = planFrontend(intake, needsAuth, needsDatabase, needsPayments, visionData);

  // 2. Backend Agent
  const backendPlan = planBackend(intake, needsAuth, needsDatabase, needsPayments);

  // 3. DevOps Agent
  const devopsPlan = planDevOps(intake, isFullStack, needsAuth, needsDatabase, needsPayments);

  // 4. Orchestrator Merge
  const summary = `${frontendPlan.appName} is a ${frontendPlan.projectTypeLabel.toLowerCase()} for ${intake.who}. ZAIRE will ship it as a ${backendPlan.isFullStack ? 'full-stack' : 'frontend-first'} experience with ${needsAuth ? 'authentication' : 'no authentication'}, ${needsDatabase ? 'persistent data' : 'no database'}, and ${needsPayments ? 'payments enabled' : 'no payments in v1'}.`;

  const stack = [
    ...frontendPlan.frontendStack,
    ...backendPlan.backendStack,
    ...backendPlan.dataStack,
    ...backendPlan.authStack,
    ...backendPlan.paymentStack
  ];

  return {
    summary,
    stack,
    pages: frontendPlan.pages,
    components: frontendPlan.components,
    apiRoutes: backendPlan.apiRoutes,
    databaseSchema: backendPlan.databaseSchema,
    authFlow: backendPlan.authFlow,
    paymentFlow: backendPlan.paymentFlow,
    envVars: devopsPlan.envVars,
    risks: devopsPlan.risks,
    assumptions: devopsPlan.assumptions,
    workflowPhases: devopsPlan.workflowPhases,
    buildChecklist: devopsPlan.buildChecklist,
    projectTypeLabel: frontendPlan.projectTypeLabel,
    normalizedName: frontendPlan.normalizedName,
    appName: frontendPlan.appName,
    isFullStack: backendPlan.isFullStack,
    needsAuth,
    needsDatabase,
    needsPayments,
    deploymentPlan: devopsPlan.deploymentPlan,
    layoutStructure: frontendPlan.layoutStructure,
    visionTokens: frontendPlan.visionTokens,
    designIntelligence: frontendPlan.designIntelligence,
    // Persistent Memory context injected into the plan for downstream consumption
    memoryContext: contextBlock ? {
      hasMemory: contextBlock.hasMemory,
      memoriesUsed: contextBlock.memories?.length || 0,
      pastProjectsReferenced: contextBlock.pastProjects?.length || 0,
      preferences: contextBlock.preferences || {}
    } : null
  };
}

function buildPageContent(plan, intake, appTitle, productDescription, bg, text, primary, displayFont, bodyFont, isLight, designBrief = null) {
  const { renderSection, COMPONENT_LIBRARY } = require('../specialists/Component_library.js');
  const { buildProfileObject, selectDnaKey } = require('./design_dna.js');

  const textMuted = isLight ? '#6b7280' : '#9ca3af';
  const border = isLight ? '#e5e7eb' : '#27272a';
  const surface = isLight ? '#f3f4f6' : '#111111';

  const tokens = {
      primaryColor: primary, bgColor: bg, textColor: text,
      textMuted, borderColor: border, surfaceColor: surface,
      displayFont, bodyFont,
      borderRadius: designBrief?.visual_tokens?.border_radius || '12px',
      neutralScale: designBrief?.visual_tokens?.neutral_scale || '#111'
  };

  const pt = (intake.projectType || plan.projectTypeLabel || 'custom').toLowerCase();
  
  // Get sections order from DNA profile
  const dnaKey = selectDnaKey ? selectDnaKey(pt) : 'TECH_FUTURISM';
  const dna = buildProfileObject ? buildProfileObject(dnaKey) : { sections_order: ['navbar', 'hero', 'features', 'testimonials', 'pricing', 'faq', 'footer'] };
  const targetOrder = (dna.sections_order || ['navbar', 'hero', 'features', 'testimonials', 'pricing', 'faq', 'footer']).map(s => s.toLowerCase());

  let pageSections = [];
  if (designBrief && designBrief.content_plan && designBrief.content_plan.length > 0) {
    pageSections = designBrief.content_plan[0].page_sections || [];
  }

  // Fallback if no page sections generated
  if (!pageSections || pageSections.length === 0) {
    pageSections = [
      { type: 'navbar', variant: 'standard', content: { logoText: appTitle, links: [] } },
      { type: 'hero', variant: 'centered', content: { headline: appTitle, subtext: productDescription, ctaLabel: 'Get Started', ctaHref: '#' } },
      { type: 'footer', variant: 'standard', content: { logoText: appTitle, links: [] } }
    ];
  }

  // Reorder according to DNA sections_order
  const orderedSections = [];
  const typeMap = {};
  pageSections.forEach(sec => {
    if (!typeMap[sec.type]) typeMap[sec.type] = [];
    typeMap[sec.type].push(sec);
  });

  // Pick sections in the order specified by DNA
  targetOrder.forEach(type => {
    if (typeMap[type] && typeMap[type].length > 0) {
      orderedSections.push(typeMap[type].shift());
    }
  });

  // Append any remaining sections that weren't in the DNA order
  pageSections.forEach(sec => {
    if (typeMap[sec.type] && typeMap[sec.type].includes(sec)) {
      orderedSections.push(sec);
      // remove from array so it isn't added twice
      typeMap[sec.type] = typeMap[sec.type].filter(s => s !== sec);
    }
  });

  const jsxSections = orderedSections.map(sec => {
    const { type, variant, content } = sec;
    
    // Validate type/variant
    if (!COMPONENT_LIBRARY || !COMPONENT_LIBRARY[type] || !COMPONENT_LIBRARY[type][variant]) {
      console.warn('[COMPONENT LIBRARY] Invalid type/variant: ' + type + '/' + variant + '. Skipping for FIX phase.');
      return '{/* [FIX] Invalid section: ' + type + '/' + variant + ' */}';
    }

    try {
      return renderSection(type, variant, tokens, content);
    } catch (e) {
      console.warn('[COMPONENT LIBRARY] Failed to render ' + type + '/' + variant + ':', e.message);
      return '{/* [FIX] Failed to render ' + type + '/' + variant + ': ' + e.message + ' */}';
    }
  }).join('\n');

  return `import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Star, ArrowRight, Check, Play, Menu, X, ArrowUpRight, Github, Twitter, Linkedin } from 'lucide-react';

export default function Page() {
  return (
    <main style={{ background: '${bg}', color: '${text}', fontFamily: "'${bodyFont}', system-ui, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      ${jsxSections}
    </main>
  );
}`;
}



/**
 * Guards against a design brief resolving an accent color that's nearly
 * invisible against the page background (e.g. #F7F7F7 primary on a #fafafa
 * light theme — exactly what produced unreadable nav/footer/CTA text).
 * Uses relative luminance distance as a cheap proxy for contrast.
 */
function hexToLuminance(hex) {
  const clean = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.substr(0, 2), 16) / 255;
  const g = parseInt(clean.substr(2, 2), 16) / 255;
  const b = parseInt(clean.substr(4, 2), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ensureReadablePrimary(candidateHex, bgHex, isLightTheme) {
  const candidateLum = hexToLuminance(candidateHex);
  const bgLum = hexToLuminance(bgHex);
  const safeFallback = isLightTheme ? '#4f46e5' : '#a78bfa'; // indigo / lavender, both readable on their theme
  if (candidateLum === null || bgLum === null) return candidateHex || safeFallback;
  // Luminance difference under ~0.3 reads as low/no contrast for UI text at these sizes.
  if (Math.abs(candidateLum - bgLum) < 0.3) return safeFallback;
  return candidateHex;
}

/**
 * THE core fix for "only 1 page gets built": buildEngineerScaffold previously
 * only ever wrote app/page.tsx, no matter how many pages plan.pages listed.
 * This generates one route file per planned page (skipping the landing page,
 * which app/page.tsx already covers), so an 11-page architecture plan actually
 * produces 11 routes instead of silently collapsing to 1.
 */
function slugifyPageName(name) {
  return (name || 'page')
    .toLowerCase()
    .replace(/[\/].*$/, '') // drop "Product Details" style suffixes after slashes if any
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}



/**
 * Maps a human font name like "Playfair Display" to a valid next/font/google export
 * identifier like "Playfair_Display" (spaces → underscores, PascalCase preserved).
 */
function fontToNextImportName(fontName) {
  if (!fontName) return 'Inter';
  // next/font/google uses underscores for spaces, preserves casing
  return fontName.trim().replace(/ /g, '_');
}

/**
 * Builds a token-driven app/layout.tsx fallback that correctly imports Google Fonts
 * using next/font/google (with PascalCase export names) and applies them to the body.
 * This is used as a safe fallback if the AI layout generation fails.
 */
function buildLayoutContent(plan, metadataTitle, metadataDescription, resolvedDisplay, resolvedBody, resolvedBg, resolvedText) {
  const displayImport = fontToNextImportName(resolvedDisplay);
  const bodyImport = fontToNextImportName(resolvedBody);

  // If both fonts are the same, only import once
  const singleFont = displayImport === bodyImport;

  const fontImports = singleFont
    ? `import { ${displayImport} } from 'next/font/google';`
    : `import { ${displayImport}, ${bodyImport} } from 'next/font/google';`;

  const fontSetup = singleFont
    ? `const primaryFont = ${displayImport}({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-primary',
  display: 'swap',
});`
    : `const displayFont = ${displayImport}({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = ${bodyImport}({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});`;

  const fontClassApply = singleFont
    ? `\${primaryFont.variable}`
    : `\${displayFont.variable} \${bodyFont.variable}`;

  return `import type { ReactNode } from 'react';
${fontImports}
import './globals.css';

${fontSetup}

export const metadata = {
  title: ${metadataTitle},
  description: ${metadataDescription},
  openGraph: {
    title: ${metadataTitle},
    description: ${metadataDescription},
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: ${metadataTitle},
    description: ${metadataDescription},
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={\`${fontClassApply} antialiased bg-[var(--color-bg)] text-[var(--color-text)] min-h-screen\`}>
        <main>{children}</main>
      </body>
    </html>
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
  const resolvedPrimary = ensureReadablePrimary(vt.primary_color, resolvedBg, isLightTheme);
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
      content: buildLayoutContent(plan, metadataTitle, metadataDescription, resolvedDisplay, resolvedBody, resolvedBg, resolvedText),
      explanation: {
        what: 'This is the root layout required by the Next.js App Router.',
        why: 'Without it, the generated app cannot run as a real Next project.',
        edit: 'Metadata, providers, and global wrappers can be added here.',
        protect: 'Keep the html/body structure and children render intact.'
      }
    },

    'app/globals.css': {
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg: ${resolvedBg};
  --color-text: ${resolvedText};
  --color-primary: ${resolvedPrimary};
  --color-neutral: ${vt.neutral_scale || '#111111'};
  --spacing-base: ${vt.spacing_system || '8px'};
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

  // AI will generate the rest of the pages instead of using the fallback stub function

  // Pass the approved designBrief through so support files use resolved tokens
  Object.assign(files, buildEngineerSupportFiles(plan, intake, skillLevel, designBrief));

  if (plan.needsAuth) {
    files['middleware.ts'] = {
      content: `import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes should be protected. Public routes are excluded.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Only protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
`,
      explanation: {
        what: 'This secures application routes with Clerk auth middleware.',
        why: 'Protected screens should not render before session checks succeed.',
        edit: 'Add more public routes to isPublicRoute matcher as needed.',
        protect: 'Do not remove the middleware export unless you remove auth completely. Ensure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set in .env.local.'
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
      'framer-motion': '^11.2.10',
      'lucide-react': '^0.395.0',
      'clsx': '^2.1.1',
      'tailwind-merge': '^2.3.0',
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
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: { workerThreads: true }
};

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
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
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

  const authEnvSection = plan.needsAuth ? `
### Auth (Clerk)
\`\`\`
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
\`\`\`
Get your keys from [dashboard.clerk.com](https://dashboard.clerk.com/last-active?path=api-keys).
` : '';

  const dbEnvSection = plan.needsDatabase ? `
### Database (Prisma / PostgreSQL)
\`\`\`
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
\`\`\`
After setting this, run: \`npx prisma db push\`
` : '';

  const paymentsEnvSection = plan.needsPayments ? `
### Payments (Stripe)
\`\`\`
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
\`\`\`
Get your keys from [dashboard.stripe.com](https://dashboard.stripe.com/apikeys).
` : '';

  const readme = `# ${plan.appName}

> ${plan.summary}

## 🚀 Getting Started

### 1. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Set up environment variables
Copy the example file and fill in your values:
\`\`\`bash
cp .env.example .env.local
\`\`\`
Then open \`.env.local\` and fill in the values below.
${authEnvSection}${dbEnvSection}${paymentsEnvSection}
### 3. Run the development server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Tech Stack
${plan.stack.map((item) => `- ${item}`).join('\n')}

## 📄 Pages
${plan.pages.map((item) => `- \`/${item.toLowerCase().replace(/ /g, '-')}\` — ${item}`).join('\n')}

## 🔧 Project Workflow
${(plan.workflowPhases || []).map((item) => `- **${item.phase}**: ${item.purpose}`).join('\n')}

## ✅ Build Checklist
${(plan.buildChecklist || []).map((item) => `- [ ] ${item}`).join('\n')}

## 📦 Scripts
| Command | Description |
|---|---|
| \`npm run dev\` | Start the development server |
| \`npm run build\` | Build for production |
| \`npm run start\` | Start the production server |
| \`npm run lint\` | Run ESLint |

## 🚢 Deployment
The easiest way to deploy is with [Vercel](https://vercel.com). Connect your repo and set the same environment variables from your \`.env.local\` file in the Vercel project settings.
`;


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

  // Previously: profile/dnaKey were function parameters that nothing ever supplied,
  // so every generation prompt below referenced an undefined DNA. Self-derive here
  // so this function works correctly even if a caller still doesn't pass them.
  if (!dnaKey) dnaKey = selectDnaKey(intake);
  if (!profile) profile = buildProfileObject(dnaKey);
  const dnaBlock = buildDnaSystemBlock(dnaKey);

  let uiBrief = brief;
  try {
    const briefObj = JSON.parse(brief.replace('DESIGN BRIEF:\n', ''));
    if (briefObj?.content_plan?.[0]) {
      const cp = briefObj.content_plan[0];
      if (cp.section_copy_briefs?.[0]?.headline_intent) heroHeadline = cp.section_copy_briefs[0].headline_intent;
      if (cp.core_message) heroSubtext = cp.core_message;
    }
    // Token Saver: Extract ONLY what's needed for UI generation to avoid injecting DB schema/auth specs into TSX prompts.
    uiBrief = JSON.stringify({
      color_palette: briefObj.color_palette || {},
      typography: briefObj.typography || {},
      motion_spec: briefObj.motion_spec || {},
      content_plan: briefObj.content_plan || []
    }, null, 2);
  } catch (e) {
    // Ignore parse errors, fallback to raw brief
  }

  const { buildSection, selectSectionsForPage } = require('./section_library');
  const skeletonTokens = {
    primaryColor: 'var(--color-primary, #4f46e5)',
    bgColor: 'var(--color-bg, #ffffff)',
    textColor: 'var(--color-text, #111111)',
    textMuted: 'var(--color-text-muted, #6b7280)',
    borderColor: 'var(--color-border, #e5e7eb)',
    surfaceColor: 'var(--color-surface, #f3f4f6)',
    displayFont: 'var(--font-display, Inter)',
    bodyFont: 'var(--font-body, Inter)',
    borderRadius: 'var(--border-radius, 12px)',
    neutralScale: 'var(--neutral-base, #111)'
  };
  
  function getSkeleton(cp, components) {
    if (!cp || !cp.section_copy_briefs) return '';
    try {
      const selected = selectSectionsForPage(cp, components, skeletonTokens, heroHeadline);
      return selected.map(({ key, content }) => buildSection(key, skeletonTokens, content)).join('\\n');
    } catch (e) {
      return '';
    }
  }

  let landingSkeleton = '';
  try {
    const briefObj = JSON.parse(brief.replace('DESIGN BRIEF:\\n', ''));
    if (briefObj?.content_plan?.[0]) {
      landingSkeleton = getSkeleton(briefObj.content_plan[0], plan.components || []);
    }
  } catch (e) {}

  const effects = selectEffects(intake);
  let effectsBlock = '';
  if (effects.length > 0) {
    effectsBlock = '\nAPPROVED EFFECTS LIBRARY (Use these snippets instead of writing from scratch):\n' + 
      effects.map(e => `- ${e.key} (Use when: ${e.use_when})\n  Approach: ${e.approach}\n  Snippet: \`${e.snippet}\``).join('\n');
  }

  const BASE_SYSTEM = `Role: ZAIRE — Elite UI/UX Engineer.
Task: Output ONLY pure, premium code (NO markdown fences, NO explanation).
Constraint: Strictly follow the Design Brief and DNA Profile. NEVER default to generic outputs.
${dnaBlock}${effectsBlock}`;

  return {
    globalsCss: {
      system: BASE_SYSTEM + `
Context: globals.css
Rules:
- MUST declare CSS custom properties for primary_color, neutral_scale, and spacing_system from the brief inside :root.
- DO NOT use @import for Google Fonts. Fonts are loaded via Next.js in layout.tsx.
- Use the actual tokens (e.g. --color-primary: #hex, --neutral-base: #hex, --spacing-base: 8px). Do not use hardcoded Tailwind default classes as fallbacks for variables.
- Include CSS reset, custom scrollbar, ::selection.
- Result must be a premium design system.`,
      user: `${uiBrief}\n\nGenerate globals.css now. Output ONLY CSS code, starting with @tailwind or :root.`
    },
    tailwindConfig: {
      system: BASE_SYSTEM + `
Context: tailwind.config.ts
Rules:
- Valid TypeScript using \`type { Config } from 'tailwindcss'\`.
- content must include: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'].
- Extend theme with DNA colors, fontFamily, custom animations (fadeUp, fadeIn, gradient-shift), screens (xs: 375px).
- NO placeholder hex values.
- CRITICAL: Do NOT import '@tailwindcss/typography' or '@tailwindcss/forms' as plugins — they may not be installed. Use an empty plugins array: plugins: [].`,
      user: `${uiBrief}\n\nGenerate tailwind.config.ts now. Output ONLY TypeScript.`
    },
    layoutTsx: {
      system: BASE_SYSTEM + `
Context: app/layout.tsx (Next.js 14)
Rules:
- Valid TSX.
- CRITICAL: Do NOT add 'use client' to this file. layout.tsx exports metadata — it must remain a Server Component.
- CRITICAL: Do NOT import from 'next/document'. Use ONLY 'next/font/google' and 'react'.
- MUST import fonts via 'next/font/google'. CRITICAL: Use EXACT PascalCase export (e.g. import { Playfair_Display }).
- Apply font variables to body className.
- Apply resolved background and text colors from the design brief to the body using CSS variables (e.g. bg-[var(--color-bg)] text-[var(--color-text)]).
- Include OpenGraph/Twitter card metadata.
- Import './globals.css'.
- Use \`suppressHydrationWarning\` on html.
- NO auth providers unless explicitly required.`,
      user: `${uiBrief}\n\nApp Name: ${heroHeadline}\nDesc: ${heroSubtext}\nGenerate app/layout.tsx now. Output ONLY code.`
    },
    pageTsx: {
      system: BASE_SYSTEM + `
Context: app/page.tsx (Landing Page)
Rules:
- CRITICAL: EXACTLY ONE 'use client'; directive at the very top. Next.js App Router requires this.
- Valid TSX.
- Tailwind CSS exclusively.
- NO lorem ipsum. Write contextual copy.
- MUST use \`framer-motion\` (animations) and \`lucide-react\` (icons).
- Track which \`lucide-react\` icons you use. NEVER use the same icon twice in the same file.
- CRITICAL: If using Lucide icons, use 'Cog' instead of 'Gear', and 'Mail' instead of 'Envelope'.
- Order: ${(profile.sections_order || ['Navbar', 'Hero', 'Features', 'Testimonials', 'Pricing', 'FAQ', 'Footer']).join(', ')}
- Minimum 5-8 complex sections (bento grids, asymmetry, floating cards). NO simple layouts.
- NO placeholders. Real data logic.
- Apply DNA spacing, borders, hover/focus states.
- Responsive classes (sm:, md:, lg:).
- SELF-CONTAINED: NO local component imports. Define ALL components inline.
- NO auth code unless requested.
- Standard ASCII/UTF-8 only (no curly quotes or em dashes).
DNA: ${dnaKey}
Hero Pattern: ${profile.hero_pattern || ''}
Layout Pattern: ${profile.layout_pattern || ''}`,
      user: `${uiBrief}

App Name: ${heroHeadline}
Desc: ${heroSubtext}
Target User: ${intake.who || 'professionals'}
${landingSkeleton ? `Pre-assembled skeleton (from ZAIRE Section Library — already token-correct):
${landingSkeleton}

Your task: Improve this skeleton. You may:
1. Add Framer Motion entrance animations to existing sections.
2. Replace placeholder content values with richer, on-brand copy from the Content Plan.
3. Add one bespoke section not in the skeleton if the Content Plan calls for something with no library match.

DO NOT restructure the skeleton. DO NOT remove sections. Output ONLY the final complete TSX.` : 'Generate complete app/page.tsx now. Output ONLY code.'}`
    },
    pages: (plan.pages || []).map(pageName => {
      const isLanding = /landing|value proposition|^home$/i.test(pageName || '');
      const slug = isLanding ? 'page' : slugifyPageName(pageName);
      
      const cpEntry = (brief?.content_plan || []).find(p => p.page === pageName);
      const cpContext = cpEntry ? `\nContent Plan for this page:\n${JSON.stringify(cpEntry, null, 2)}\n` : '';

      const pageComponents = (plan.components || []).filter(c => c.is_section_of === pageName || (isLanding && !c.is_section_of));
      const compContext = pageComponents.length > 0 ? `\nPlanned Components to Build:\n${pageComponents.map(c => `- ${c.name}: ${c.purpose || c.type || ''}`).join('\n')}\n` : '';

      let pageSkeleton = '';
      if (cpEntry) {
        pageSkeleton = getSkeleton(cpEntry, pageComponents);
      }

      return {
        name: pageName,
        slug: slug,
        system: BASE_SYSTEM + `
Context: app/${slug === 'page' ? '' : slug + '/'}page.tsx (${pageName})
Rules:
- CRITICAL: EXACTLY ONE 'use client'; directive at the very top. Next.js App Router requires this.
- Valid TSX.
- MUST implement EVERY component listed in "Planned Components to Build". DO NOT drop sections.
- MUST use \`framer-motion\` and \`lucide-react\`.
- Track which \`lucide-react\` icons you use. NEVER use the same icon twice in the same file.
- CRITICAL: If using Lucide icons, use 'Cog' instead of 'Gear', and 'Mail' instead of 'Envelope'.
- NO simple text boxes. Use bento grids and asymmetric layouts.
- Contextual copy. NO lorem ipsum.
- NO placeholders.
- Apply DNA spacing, borders, animation.
- Include Navbar/Footer if standalone.
- SELF-CONTAINED: NO local component imports. Define ALL components inline.
- NO auth code.
- CRITICAL: For shopping cart or checkout pages, MUST import { useState } from 'react' and explicitly type cart items.
- Standard ASCII/UTF-8 only.`,
        user: `${uiBrief}

App Name: ${heroHeadline}
Page Topic: ${pageName}${cpContext}${compContext}
${pageSkeleton ? `Pre-assembled skeleton (from ZAIRE Section Library — already token-correct):
${pageSkeleton}

Your task: Improve this skeleton. You may:
1. Add Framer Motion entrance animations to existing sections.
2. Replace placeholder content values with richer, on-brand copy from the Content Plan.
3. Add one bespoke section not in the skeleton if the Content Plan calls for something with no library match.

DO NOT restructure the skeleton. DO NOT remove sections. Output ONLY the final complete TSX.` : 'Generate complete TSX code. Output ONLY code.'}`
      };
    }),
    selfReview: {
      system: BASE_SYSTEM + `
Role: Quality Enforcement Agent. Audit TSX and fix ALL violations.

CHECKLIST (Fix ALL before returning):
- [ ] framer-motion used for 3+ animation types (scroll reveal, stagger, hover).
- [ ] 5+ FULL sections (no plain boxes, use bento/grids).
- [ ] ZERO lorem ipsum. Contextual copy only.
- [ ] NO local component imports. Define ALL inline.
- [ ] NO auth libraries (unless requested).
- [ ] Straight quotes only. No em dashes.

Return COMPLETE corrected TSX. NO markdown fences.`,
      user: (pageContent) => `${uiBrief}\n\nApp: ${heroHeadline}\nUser: ${intake.who || 'professionals'}\n\nCURRENT FILE TO FIX:\n${pageContent}\n\nAudit and fix ALL items. Return ONLY corrected code.`
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

function buildArchitecturePrompts(intake, contextBlock = null) {
  const memoryPrompt = contextBlock ? memoryAgent.buildContextPrompt(contextBlock) : '';

  const systemPrompt = `${memoryPrompt}
You are an expert AI software architect.
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

function buildCapabilitiesGuardPrompt(requestText) {
  const systemPrompt = `You are the ZAIRE Capabilities Guard.
Your job is to intercept impossible user requests before they waste API tokens.
ZAIRE is a 2D web app generator (Next.js 14, Tailwind CSS, Framer Motion).

CAPABILITY LIMITS:
- NO 3D rendering, WebGL, Three.js, React Three Fiber, or WebXR.
- NO native mobile apps (iOS/Android).
- NO complex game loops or game engines.
- NO custom hardware integrations (IoT, Bluetooth, etc.).

If the user's request violates these limits (e.g. "make a 3D car configurator"), you MUST rewrite it into a feasible 2D premium equivalent (e.g. "Premium landing page for a car configurator with smooth scrolling, high-end imagery, and modern UI").
If the request is already feasible, return it exactly as is, without adding conversational text.

Return ONLY the rewritten or accepted request text. NO markdown fences. NO explanation.`;

  const userPrompt = `USER REQUEST:
"${requestText}"

Analyze and return the feasible request text.`;

  return { system: systemPrompt, user: userPrompt };
}

module.exports = {
  buildEngineerPlan,
  buildEngineerScaffold,
  buildGenerationPrompts,
  buildIncrementalPlan,
  buildArchitecturePrompts,
  buildCapabilitiesGuardPrompt,
  buildPageContent
};