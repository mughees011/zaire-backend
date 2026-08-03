const pool = require('./db/db');
const memoryAgent = require('./services/agents/memory_agent');

async function runTests() {
  console.log('--- STARTING MEMORY AGENT TESTS ---');
  const userId = 'test-memory-user-' + Date.now();

  try {
    // 1. Initial Load (Should be empty)
    console.log('\n[TEST 1] Loading context for new user...');
    let contextBlock = await memoryAgent.loadEngineerContext(userId, pool);
    console.log('Has memory?', contextBlock.hasMemory);
    console.assert(contextBlock.hasMemory === false, 'New user should not have memory');

    // 2. Simulate User Preference Change
    console.log('\n[TEST 2] Updating user preferences...');
    const prefsUpdated = await memoryAgent.updateUserPreferences(userId, {
      preferredStack: 'Next.js + Tailwind',
      preferredDeployment: 'Vercel'
    }, pool);
    console.log('Prefs updated?', prefsUpdated);
    console.assert(prefsUpdated === true, 'Failed to update preferences');

    // 3. Load Context Again (Should have preferences)
    console.log('\n[TEST 3] Loading context after preference update...');
    contextBlock = await memoryAgent.loadEngineerContext(userId, pool);
    console.log('Has memory?', contextBlock.hasMemory);
    console.assert(contextBlock.hasMemory === true, 'User should now have memory');
    console.log('Preferences:', contextBlock.preferences);

    // 4. Enrich Intake
    console.log('\n[TEST 4] Enriching intake...');
    const rawIntake = { what: 'A simple blog' };
    const enrichedIntake = memoryAgent.enrichIntakeFromMemory(rawIntake, contextBlock);
    console.log('Original intake:', rawIntake);
    console.log('Enriched intake:', enrichedIntake);
    console.assert(enrichedIntake.deploymentTarget === 'Vercel', 'Intake should be enriched with deployment target');

    // 5. Build Context Prompt
    console.log('\n[TEST 5] Building context prompt...');
    const prompt = memoryAgent.buildContextPrompt(contextBlock);
    console.log('\n--- PROMPT START ---\n' + prompt + '\n--- PROMPT END ---');
    console.assert(prompt.includes('Vercel'), 'Prompt should include Vercel');

    // 6. Simulate Plan Completion and Save Memory
    console.log('\n[TEST 6] Saving memories after plan completion...');
    const mockPlan = {
      stack: ['React', 'Supabase'],
      needsAuth: true,
      designIntelligence: {
        mode: 'dark',
        personality: 'modern',
        era: 'minimal'
      },
      projectTypeLabel: 'SaaS App'
    };
    await memoryAgent.saveEngineerMemory(userId, null, mockPlan, enrichedIntake, pool);
    
    // Wait for the fire-and-forget save to complete (since we didn't await it in the route, but here we did await the function call directly)
    
    // 7. Load Context Final
    console.log('\n[TEST 7] Loading context after memory save...');
    contextBlock = await memoryAgent.loadEngineerContext(userId, pool);
    console.log('Memories loaded:', contextBlock.memories.length);
    console.assert(contextBlock.memories.length > 0, 'Memories should have been saved and loaded');
    contextBlock.memories.forEach(m => console.log(`  - [${m.category}] ${m.text}`));

    console.log('\n✅ ALL TESTS PASSED!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
  } finally {
    // Cleanup
    try {
      console.log('\nCleaning up test data...');
      await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM memories WHERE user_id = $1', [userId]);
    } catch(e) {
      console.error('Cleanup failed', e);
    }
    pool.end();
  }
}

runTests();
