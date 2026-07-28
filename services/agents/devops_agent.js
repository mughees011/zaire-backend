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

function planDevOps(intake, isFullStack, needsAuth, needsDatabase, needsPayments) {
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

  const buildChecklist = [
    'Confirm the intake answers before generating the scaffold.',
    'Approve the architecture only after the plan matches the business goal.',
    'Create the shell and API routes before visual polish.',
    'Run review, QA, and repair passes before package/deploy.',
    'Verify required environment variables before shipping.'
  ];

  const deploymentPlan = [
    `Primary hosting target: ${intake.deploymentTarget || 'Vercel'}`,
    isFullStack ? 'Run frontend and API together in the App Router deployment.' : 'Ship a frontend-only bundle with managed API integrations later if needed.',
    needsDatabase ? 'Provision PostgreSQL and attach pooled connection settings.' : 'No database provisioning needed.',
    needsAuth ? 'Configure auth redirect URLs before launch.' : 'No auth secrets required.'
  ];

  return {
    envVars,
    risks,
    assumptions,
    buildChecklist,
    deploymentPlan,
    workflowPhases: buildWorkflowPhases()
  };
}

module.exports = { planDevOps };
