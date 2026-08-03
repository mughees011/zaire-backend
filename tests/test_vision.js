const { buildEngineerPlan } = require('../services/engineer_workflow');

const mockIntake = {
  projectType: 'portfolio',
  projectName: 'Vision App',
  who: 'designers',
  auth: 'no',
  database: 'no',
  payments: 'no',
  scope: 'frontend-only',
  deploymentTarget: 'Vercel'
};

const mockVisionData = {
  colorPalette: {
    primary: "#FF5733",
    background: "#121212",
    text: "#F0F0F0",
    accent: "#00E5FF"
  },
  typography: {
    display: "Inter",
    body: "Roboto"
  },
  layoutStructure: "Navbar at top, Hero with split layout (text left, image right), 4-column Bento grid below, simple footer.",
  components: ["Navbar", "SplitHero", "BentoGrid", "Footer"]
};

try {
  const plan = buildEngineerPlan(mockIntake, mockVisionData);
  console.log('Successfully generated architecture plan with Vision Data:');
  console.log(JSON.stringify(plan, null, 2));
} catch (error) {
  console.error('Failed to generate architecture plan:', error);
}
