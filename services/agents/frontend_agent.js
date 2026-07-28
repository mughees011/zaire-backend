const { normalizeProjectName, safeDisplayText, inferProjectTypeLabel } = require('./agent_utils');

function planFrontend(intake, needsAuth, needsDatabase, needsPayments, visionData = null) {
  const projectTypeLabel = inferProjectTypeLabel(intake.projectType);
  const normalizedName = normalizeProjectName(intake.projectName);
  const appName = safeDisplayText(intake.projectName, normalizedName);

  // ── STACK ─────────────────────────────────────────────────────────────────
  const frontendStack = ['Next.js 14 App Router', 'TypeScript', 'Tailwind CSS'];

  // If Vision Agent suggests a motion library, add it to the stack
  if (visionData?.motion?.suggestedLibrary && visionData.motion.suggestedLibrary !== 'none') {
    frontendStack.push(visionData.motion.suggestedLibrary);
  }

  // ── PAGES ─────────────────────────────────────────────────────────────────
  const pages = [
    'Landing / value proposition',
    'Authenticated workspace',
    'Project detail / execution view',
    ...(needsPayments ? ['Billing / plan management'] : []),
    ...(needsAuth ? ['Sign in / sign up'] : [])
  ];

  // ── COMPONENTS ────────────────────────────────────────────────────────────
  const baseComponents = [
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

  const components = [...baseComponents];

  // ── VISION AGENT MERGE ────────────────────────────────────────────────────
  // When visionData is present, we layer the AI-extracted intelligence on top.
  // All of these are passed through to the final plan for the code generator.

  let designIntelligence = null;

  if (visionData) {
    // 1. Merge components: Add vision-detected ones if not already present
    if (Array.isArray(visionData.components)) {
      visionData.components.forEach(c => {
        if (!components.includes(c)) components.push(c);
      });
    }

    // 2. Build the full design intelligence block from all 7 stages
    designIntelligence = {
      // Mood
      mode: visionData.mode,
      personality: visionData.personality,
      era: visionData.era,
      feeling: visionData.feeling,
      density: visionData.density,
      hasGlassmorphism: visionData.hasGlassmorphism,
      hasGradients: visionData.hasGradients,
      hasBorderRadius: visionData.hasBorderRadius,
      hasShadows: visionData.hasShadows,
      animationComplexity: visionData.animationComplexity,

      // Full color system
      colorPalette: visionData.colorPalette,

      // Full typography system
      typography: visionData.typography,

      // Layout system
      layout: visionData.layout,

      // Component details with props
      componentDetails: visionData.componentDetails,
      missingComponents: visionData.missingComponents,

      // Motion system
      motion: visionData.motion,

      // Accessibility
      accessibility: visionData.accessibility
    };
  }

  return {
    projectTypeLabel,
    normalizedName,
    appName,
    frontendStack,
    pages,
    components,
    // Legacy single-field support for backward compatibility
    layoutStructure: visionData?.layout?.sectionBreakdown
      ? visionData.layout.sectionBreakdown.map(s => `${s.sectionName}: ${s.description}`).join(' → ')
      : null,
    visionTokens: visionData
      ? { colorPalette: visionData.colorPalette, typography: visionData.typography }
      : null,
    // Full design intelligence for advanced code generation
    designIntelligence
  };
}

module.exports = { planFrontend };
