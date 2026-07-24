const memory = require('./memory_service');
const proactive = require('./proactive_service');

async function runAudit() {
    console.log('--- ZAIRE CORE 2.0 STABILITY AUDIT ---');

    // 1. Verify Gaze Memory Persistence
    console.log('[AUDIT] Testing Gaze Memory Persistence...');
    memory.persistVisualEcho("AUDIT TEST: ZAIRE is watching the code. Technical state: Stable.");
    
    // 2. Verify Sentinel Diagnostic Call
    console.log('[AUDIT] Testing Sentinel System Health...');
    try {
        const fetch = require('node-fetch');
        const health = await fetch('http://127.0.0.1:3002/system/health_sentinel').then(r => r.json());
        console.log('[AUDIT] Sentinel Response:', JSON.stringify(health, null, 2));
    } catch (e) {
        console.log('[AUDIT] Sentinel connectivity failed. Is the Agent Daemon running?');
    }

    console.log('--- AUDIT COMPLETE ---');
}

runAudit();
