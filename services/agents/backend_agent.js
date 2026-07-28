function planBackend(intake, needsAuth, needsDatabase, needsPayments) {
  const isFullStack = String(intake.scope || '').toLowerCase() === 'full-stack' || needsAuth || needsDatabase || needsPayments;

  const backendStack = isFullStack ? ['Route Handlers', 'Server Actions', 'Node runtime'] : ['Static app shell', 'Client fetch orchestration'];
  const dataStack = needsDatabase ? ['PostgreSQL', 'Prisma ORM'] : ['No persistent database required'];
  const authStack = needsAuth ? ['Clerk authentication', 'Protected dashboard middleware'] : ['Anonymous access or lightweight session state'];
  const paymentStack = needsPayments ? ['Stripe checkout', 'Webhook-based billing sync'] : ['No payment rails required'];

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

  return {
    isFullStack,
    backendStack,
    dataStack,
    authStack,
    paymentStack,
    apiRoutes,
    databaseSchema,
    authFlow,
    paymentFlow
  };
}

module.exports = { planBackend };
