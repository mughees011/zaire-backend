
const { analyzeScreen } = require('../specialists/vision_service');
const fetch = require('node-fetch');

const BACKEND_URL = 'http://127.0.0.1:3001/engineer/echo_detect';

async function echoLoop() {
    console.log('[VISUAL ECHO] Gaze Memory active. Monitoring screen for context...');
    while (true) {
        try {
            // Ask the vision core about the screen content
            const question = "What is the user currently working on? Describe the active applications, documents, and the overall context in one concise sentence.";
            const analysis = await analyzeScreen(question);
            
            console.log('[GAZE_MEMORY] Context captured:', analysis);
            
            // Store in Vector Memory
            await fetch('http://127.0.0.1:3004/memory/remember', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: `User Work Snapshot: ${analysis}`, 
                    metadata: { type: 'gaze_memory', timestamp: new Date().toISOString() } 
                })
            });

            // Heuristic for design-specific alerts
            const isDesign = analysis.toLowerCase().includes('design') || 
                             analysis.toLowerCase().includes('layout') || 
                             analysis.toLowerCase().includes('figma');

            if (isDesign) {
                await fetch(BACKEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ analysis })
                });
            }
        } catch (e) {
            console.error('[VISUAL ECHO] Cycle anomaly:', e.message);
        }
        await new Promise(r => setTimeout(r, 300000)); // Standard 5 min poll for Gaze Memory
    }
}

echoLoop();
