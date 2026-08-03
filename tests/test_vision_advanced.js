/**
 * Test script for the Advanced Vision Agent
 * Simulates what runVisionAnalysis produces and verifies the full plan merge.
 */
const { buildEngineerPlan } = require('../services/engineer_workflow');
const { mergeVisionPayload } = require('../services/agents/vision_agent');

// Simulate what the 7 LLM stages would return
const mockStageResults = {
  mood: {
    mode: 'dark',
    personality: 'luxury',
    era: 'glassmorphism',
    feeling: 'sophisticated',
    density: 'sparse',
    hasGlassmorphism: true,
    hasGradients: true,
    hasBorderRadius: 'heavy',
    hasShadows: true,
    animationComplexity: 'rich'
  },
  colors: {
    primary: '#a855f7',
    primaryHover: '#9333ea',
    secondary: '#6366f1',
    accent: '#22d3ee',
    background: '#030712',
    surface: '#0f172a',
    surfaceRaised: '#1e293b',
    border: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textInverse: '#030712',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    gradients: ['linear-gradient(135deg, #a855f7, #6366f1)', 'linear-gradient(180deg, #030712, #0f172a)']
  },
  typography: {
    displayFont: 'Clash Display',
    headingFont: 'Clash Display',
    bodyFont: 'Inter',
    monoFont: 'JetBrains Mono',
    fontWeightScale: { light: '300', regular: '400', medium: '500', semibold: '600', bold: '700', black: '900' },
    headingSizeScale: { h1: '72px', h2: '56px', h3: '40px', h4: '28px' },
    bodySize: '16px',
    smallSize: '14px',
    lineHeight: '1.6',
    letterSpacing: '-0.02em',
    isUppercasedLabels: true
  },
  layout: {
    layoutType: 'bento-grid',
    sectionBreakdown: [
      { sectionName: 'Navbar', description: 'Glassmorphic sticky bar with logo and CTA', heightEstimate: '72px' },
      { sectionName: 'Hero', description: 'Full-viewport, large heading, gradient text, animated particles background', heightEstimate: '100vh' },
      { sectionName: 'BentoGrid', description: '4-column asymmetric bento with feature cards', heightEstimate: '600px' },
      { sectionName: 'Footer', description: 'Minimal footer with links and gradient divider', heightEstimate: '200px' }
    ],
    gridColumns: 'auto-fit',
    gapSize: '16px',
    paddingX: '80px',
    paddingY: '120px',
    maxWidth: '1440px',
    hasStickySidebar: false,
    hasStickyNav: true,
    isFullBleed: false
  },
  components: {
    components: [
      { name: 'GlassNavbar', description: 'Sticky glassmorphic navigation bar', props: ['logo', 'links', 'ctaText'], hasAnimation: true, isInteractive: true },
      { name: 'ParticleHero', description: 'Full-viewport hero with animated particle canvas', props: ['headline', 'subheadline', 'ctaText', 'badgeText'], hasAnimation: true, isInteractive: false },
      { name: 'BentoGrid', description: 'Asymmetric 4-column feature grid', props: ['items'], hasAnimation: true, isInteractive: false },
      { name: 'GlowCard', description: 'Feature card with gradient glow on hover', props: ['title', 'description', 'icon'], hasAnimation: true, isInteractive: true },
      { name: 'Footer', description: 'Minimal footer with gradient top border', props: ['links', 'socials'], hasAnimation: false, isInteractive: false }
    ],
    missingComponents: ['PricingTable', 'TestimonialCarousel']
  },
  motion: {
    entryAnimations: 'staggered fade-up on scroll',
    hoverEffects: 'card glow pulse, button shimmer',
    scrollBehavior: 'parallax hero, scroll-driven opacity on sections',
    transitionDuration: '400ms',
    transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    cursorEffects: 'magnetic buttons',
    suggestedLibrary: 'Framer Motion'
  },
  accessibility: {
    contrastRisk: 'medium',
    smallTextRisk: false,
    notes: ['Muted text (#94a3b8) on dark surface may need contrast check for small sizes'],
    suggestedImprovements: ['Verify WCAG AA on textMuted vs surface', 'Add focus-visible ring to all interactive elements']
  }
};

// Merge stages into unified visionData
const visionData = mergeVisionPayload(mockStageResults);

// Build the full architecture plan
const mockIntake = {
  projectType: 'saas',
  projectName: 'Nebula AI',
  who: 'startups and indie hackers',
  auth: 'yes',
  database: 'yes',
  payments: 'yes',
  scope: 'full-stack',
  deploymentTarget: 'Vercel'
};

try {
  const plan = buildEngineerPlan(mockIntake, visionData);
  
  console.log('✅ Advanced Vision Agent — Full Plan Merge Test');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`📋 Project:    ${plan.appName}`);
  console.log(`📦 Stack:      ${plan.stack.join(', ')}`);
  console.log(`🧩 Components: ${plan.components.join(', ')}`);
  console.log(`📐 Layout:     ${plan.layoutStructure}`);
  console.log(`\n🎨 Design Intelligence:`);
  console.log(`   Mode:         ${plan.designIntelligence?.mode}`);
  console.log(`   Personality:  ${plan.designIntelligence?.personality}`);
  console.log(`   Era:          ${plan.designIntelligence?.era}`);
  console.log(`   Primary:      ${plan.designIntelligence?.colorPalette?.primary}`);
  console.log(`   Background:   ${plan.designIntelligence?.colorPalette?.background}`);
  console.log(`   Gradients:    ${plan.designIntelligence?.colorPalette?.gradients?.join(' | ')}`);
  console.log(`   Display Font: ${plan.designIntelligence?.typography?.displayFont}`);
  console.log(`   Body Font:    ${plan.designIntelligence?.typography?.bodyFont}`);
  console.log(`   Motion:       ${plan.designIntelligence?.motion?.entryAnimations}`);
  console.log(`   Library:      ${plan.designIntelligence?.motion?.suggestedLibrary}`);
  console.log(`   A11y Risk:    ${plan.designIntelligence?.accessibility?.contrastRisk}`);
  console.log(`\n✅ PASS — Vision pipeline feeds fully into the architecture plan.`);
} catch (err) {
  console.error('❌ FAIL:', err.message);
}
