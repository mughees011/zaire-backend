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

function buildEngineerScaffold(plan, intake = {}, skillLevel = 'PROFESSIONAL') {
  const appTitle = safeDisplayText(plan.appName, plan.normalizedName || 'ZAIRE Project');
  const productDescription = safeDisplayText(intake.what, plan.summary || 'Generated by ZAIRE Engineer Mode.');
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
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #050505;
  color: #ffffff;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`,
      explanation: {
        what: 'This provides Tailwind directives and base runtime styling.',
        why: 'The generated pages use Tailwind classes and need global CSS to render correctly.',
        edit: 'Brand tokens and base styles can be refined here.',
        protect: 'Keep the Tailwind directives while Tailwind is part of the stack.'
      }
    },
    'app/page.tsx': {
      content: `export default function Page() {\n  return (\n    <main className="min-h-screen bg-black text-white">\n      <section className="mx-auto max-w-6xl px-6 py-24">\n        <h1 className="text-5xl font-semibold tracking-tight">${appTitle}</h1>\n        <p className="mt-4 max-w-2xl text-zinc-400">\n          ${productDescription}\n        </p>\n      </section>\n    </main>\n  );\n}\n`,
      explanation: {
        what: 'This is the launch page for the product experience.',
        why: 'Every project needs a reliable entry route that expresses value immediately.',
        edit: 'Hero copy, section order, and call-to-action text are safe to change.',
        protect: 'Keep the exported page contract and core layout shell intact.'
      }
    },
    'app/(workspace)/dashboard/page.tsx': {
      content: `export default function DashboardPage() {\n  return (\n    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">\n      <section className="rounded-2xl border border-white/10 p-6">\n        <h2 className="text-2xl font-semibold">Execution Workspace</h2>\n        <p className="mt-3 text-sm text-zinc-400">\n          Track architecture decisions, build phases, and QA readiness in one view.\n        </p>\n      </section>\n    </div>\n  );\n}\n`,
      explanation: {
        what: 'This file renders the logged-in workspace used for execution.',
        why: 'It gives engineers a focused place to act after landing.',
        edit: 'Cards, data modules, and supporting copy are safe to adapt.',
        protect: 'Avoid removing the route or changing the workspace contract without updating navigation.'
      }
    }
  };

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

module.exports = {
  buildEngineerPlan,
  buildEngineerScaffold
};

