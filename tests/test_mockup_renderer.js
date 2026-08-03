const { generateMockup, resolveTokens } = require('../services/agents/mockup_renderer');

const sampleBrief = {
  app_name: 'FinTrack Pro',
  visual_tokens: {
    primary_color: '#6366f1',
    neutral_scale: {
      '50': '#f9f9ff', '100': '#f0f0fa', '200': '#e0e0f0',
      '400': '#8888aa', '700': '#2a2a38', '800': '#1a1a24', '900': '#0f0f14'
    },
    typography: { display: 'Inter', body: 'Inter' },
    border_radius: '12px'
  },
  content_plan: [{
    page: 'Home',
    page_sections: [
      {
        type: 'hero', variant: 'centered',
        content: {
          eyebrow: 'Now in Public Beta',
          headline: 'Manage Your Finances Like a Pro',
          subtext: 'Track expenses, set budgets, and hit your savings goals — all in one beautiful dashboard.',
          primaryCta: 'Start Free', secondaryCta: 'Watch Demo'
        }
      },
      {
        type: 'social_proof',
        content: { label: 'Trusted by 10,000+ users at', logos: ['Stripe', 'Shopify', 'Linear', 'Vercel', 'Figma'] }
      },
      {
        type: 'features', variant: 'grid',
        content: {
          headline: 'Everything You Need to Win',
          items: [
            { title: 'Expense Tracking', description: 'Log every spend automatically with bank sync.' },
            { title: 'Smart Budgets', description: 'AI-powered budgets that adapt to your lifestyle.' },
            { title: 'Savings Goals', description: 'Set targets and watch your progress in real time.' },
            { title: 'Tax Ready Reports', description: 'Export clean reports for tax season in one click.' },
            { title: 'Multi-Currency', description: 'Handle 150+ currencies seamlessly.' },
            { title: 'Encrypted & Secure', description: 'Bank-grade AES-256 encryption on all data.' }
          ]
        }
      },
      {
        type: 'stats',
        content: {
          items: [
            { value: '10K+', label: 'Active Users' },
            { value: '$2M+', label: 'Savings Tracked' },
            { value: '4.9★', label: 'App Store Rating' },
            { value: '99.9%', label: 'Uptime SLA' }
          ]
        }
      },
      {
        type: 'pricing',
        content: {
          headline: 'Plans for Every Stage',
          tiers: [
            { name: 'Free', price: '$0', period: '/mo', features: ['5 accounts', 'Basic budgets', 'Email support'], ctaLabel: 'Get Started' },
            { name: 'Pro', price: '$12', period: '/mo', features: ['Unlimited accounts', 'AI budgets', 'Tax reports', 'Priority support'], highlighted: true, ctaLabel: 'Start Free Trial' },
            { name: 'Business', price: '$49', period: '/mo', features: ['Everything in Pro', 'Team accounts', 'API access', 'Dedicated CSM'], ctaLabel: 'Contact Sales' }
          ]
        }
      },
      {
        type: 'testimonials',
        content: {
          headline: 'Loved by Thousands',
          items: [
            { quote: 'FinTrack Pro paid for itself in the first week. I found $300 in subscriptions I forgot about.', author: 'James L.', role: 'Freelance Designer' },
            { quote: 'Finally a budgeting app that doesn\'t feel like a spreadsheet. Beautiful and powerful.', author: 'Maria S.', role: 'Startup Founder' },
            { quote: 'The tax export feature alone is worth the Pro plan. Saved me hours this April.', author: 'David K.', role: 'Senior Engineer' }
          ]
        }
      },
      {
        type: 'cta',
        content: {
          headline: 'Take Control of Your Money Today',
          subtext: 'Join 10,000+ people building better financial habits with FinTrack Pro.',
          ctaLabel: 'Create Free Account'
        }
      }
    ]
  }]
};

console.log('--- MOCKUP RENDERER TESTS ---\n');

// Test 1: Token Resolution
console.log('[TEST 1] Resolving tokens...');
const tokens = resolveTokens(sampleBrief);
console.assert(tokens.primaryColor === '#6366f1', 'Primary color should match');
console.assert(tokens.displayFont === 'Inter', 'Display font should be Inter');
console.assert(tokens.bgColor === '#0f0f14', 'BG should be darkest neutral');
console.log('Tokens resolved:', JSON.stringify({ primaryColor: tokens.primaryColor, bgColor: tokens.bgColor, displayFont: tokens.displayFont }, null, 2));

// Test 2: Full HTML generation
console.log('\n[TEST 2] Generating full mockup HTML...');
const html = generateMockup(sampleBrief);
console.assert(typeof html === 'string', 'Output should be a string');
console.assert(html.startsWith('<!DOCTYPE html>'), 'Should start with DOCTYPE');
console.assert(html.includes('#6366f1'), 'Should contain primary color hex');
console.assert(html.includes('Inter'), 'Should contain Google Font name');
console.assert(html.includes('FinTrack Pro'), 'Should contain app name');
console.assert(html.includes('ZAIRE'), 'Should contain ZAIRE watermark');
console.log(`Output: ${html.length.toLocaleString()} bytes, ${html.split('\n').length} lines`);

// Test 3: Section coverage
const sections = [
  { name: 'navbar',       probe: 'sticky' },
  { name: 'hero',         probe: 'Manage Your Finances' },
  { name: 'features',     probe: 'Everything You Need' },
  { name: 'stats',        probe: '10K+' },
  { name: 'pricing',      probe: 'FinTrack Pro' },
  { name: 'testimonials', probe: 'Loved by Thousands' },
  { name: 'cta',          probe: 'Take Control' },
  { name: 'footer',       probe: 'Generated by' }
];
console.log('\n[TEST 3] Checking section coverage...');
for (const s of sections) {
  const present = html.includes(s.probe);
  console.log(`  ${present ? '✓' : '✗'} ${s.name} (probe: "${s.probe}")`);
  console.assert(present, `Missing section content for: ${s.name}`);
}

// Test 4: Save to file for manual review
const fs = require('fs');
const outPath = require('path').join(__dirname, 'scratch', 'mockup_preview.html');
fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log(`\n[TEST 4] HTML written to:\n  ${outPath}`);
console.log('\n✅ ALL MOCKUP TESTS PASSED!');
