const { evaluateAmbiguity } = require('./services/agents/clarification_agent');

async function runTests() {
  console.log('--- CLARIFICATION AGENT TESTS ---\n');

  console.log('[TEST 1] Highly Specific Prompt (Should Pass)');
  const specificPrompt = "Build a SaaS dashboard for real estate agents using Next.js, dark mode, Stripe payments, and a PostgreSQL database. It needs a login page and a metrics overview.";
  const res1 = await evaluateAmbiguity(specificPrompt);
  console.log('Result:', JSON.stringify(res1, null, 2));
  console.assert(res1.needsClarification === false, 'Test 1 Failed: Should not need clarification.');
  console.log(res1.needsClarification === false ? '✓ Passed\n' : '✗ Failed\n');

  console.log('[TEST 2] Highly Vague Prompt (Should Ask Questions)');
  const vaguePrompt = "Make a cool website for my dog.";
  const res2 = await evaluateAmbiguity(vaguePrompt);
  console.log('Result:', JSON.stringify(res2, null, 2));
  console.assert(res2.needsClarification === true, 'Test 2 Failed: Should need clarification.');
  console.assert(Array.isArray(res2.questions) && res2.questions.length > 0, 'Test 2 Failed: Should return questions.');
  console.log(res2.needsClarification === true ? '✓ Passed\n' : '✗ Failed\n');

  console.log('✅ ALL TESTS COMPLETE!');
}

runTests();
