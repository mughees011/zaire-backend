const { qaProject, repairError, applyAndVerifyRepair } = require('./services/engineer_qa_repair');
const repairAgent = require('./services/agents/repair_agent');

async function testRepair() {
  console.log('--- STARTING REPAIR AGENT TESTS ---');
  
  // 1. Create a broken file
  const brokenContent = `
    import React from 'react';
    // MISSING useState IMPORT
    
    export default function BrokenComponent() {
      const [count, setCount] = useState(0); // ReferenceError: useState is not defined
      return <div onClick={() => setCount(count + 1)}>{count}</div>;
    }
  `;
  
  const files = [
    { path: 'src/components/BrokenComponent.jsx', content: brokenContent }
  ];
  
  const errorText = "ReferenceError: useState is not defined in src/components/BrokenComponent.jsx on line 5";

  console.log('\n[TEST 1] Building repair prompt...');
  const prompts = repairAgent.buildRepairPrompt(errorText, brokenContent, 'src/components/BrokenComponent.jsx');
  console.log('System Prompt generated?', !!prompts.system);
  console.log('User Prompt generated?', !!prompts.user);
  
  console.assert(prompts.system.includes('JSON'), 'Prompt should ask for JSON');
  
  // Mocking the LLM Response
  console.log('\n[TEST 2] Simulating LLM response and applying patch...');
  const mockLlmResponse = {
    path: 'src/components/BrokenComponent.jsx',
    content: `
    import React, { useState } from 'react';
    
    export default function BrokenComponent() {
      const [count, setCount] = useState(0);
      return <div onClick={() => setCount(count + 1)}>{count}</div>;
    }
    `,
    explanation: "Imported useState from react."
  };
  
  const directPatches = [mockLlmResponse];
  
  // Calling applyAndVerifyRepair with mock LLM patch
  // Passing dummy projectId 'test' which qaProject uses to create a scratch dir
  const verifyResult = await applyAndVerifyRepair('test', files, null, directPatches);
  
  console.log('Patched file content:\n', verifyResult.patchedFiles[0].content);
  console.assert(verifyResult.patchedFiles[0].content.includes('{ useState }'), 'File should have been patched with useState');
  
  console.log('\n✅ REPAIR LOOP LOGIC PASSED');
}

testRepair().catch(console.error);
