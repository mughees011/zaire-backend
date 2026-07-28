const { normalizeProjectName, safeDisplayText, inferProjectTypeLabel } = require('./agent_utils');

function planFrontend(intake, needsAuth, needsDatabase, needsPayments, visionData = null) {
  const projectTypeLabel = inferProjectTypeLabel(intake.projectType);
  const normalizedName = normalizeProjectName(intake.projectName);
  const appName = safeDisplayText(intake.projectName, normalizedName);

  const frontendStack = ['Next.js 14 App Router', 'TypeScript', 'Tailwind CSS'];

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

  // Merge Vision Data if present
  let layoutStructure = null;
  let visionTokens = null;

  if (visionData) {
    if (Array.isArray(visionData.components)) {
      // Append AI-detected components that aren't already in the list
      visionData.components.forEach(c => {
        if (!components.includes(c)) components.push(c);
      });
    }
    if (visionData.layoutStructure) {
      layoutStructure = visionData.layoutStructure;
    }
    if (visionData.colorPalette || visionData.typography) {
      visionTokens = {
        colorPalette: visionData.colorPalette,
        typography: visionData.typography
      };
    }
  }

  return {
    projectTypeLabel,
    normalizedName,
    appName,
    frontendStack,
    pages,
    components,
    layoutStructure,
    visionTokens
  };
}

module.exports = { planFrontend };
