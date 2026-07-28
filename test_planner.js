const { buildEngineerPlan } = require('./services/engineer_workflow');

const mockIntake = {
  projectType: 'saas',
  projectName: 'Test App',
  who: 'developers',
  auth: 'yes',
  database: 'yes',
  payments: 'no',
  scope: 'full-stack',
  deploymentTarget: 'Vercel'
};

try {
  const plan = buildEngineerPlan(mockIntake);
  console.log('Successfully generated architecture plan:');
  console.log(JSON.stringify(plan, null, 2));
} catch (error) {
  console.error('Failed to generate architecture plan:', error);
}
