/**
 * Vision Service — ZAIRE Screen Awareness
 * Uses the Python sidecar to capture the screen and Groq vision API to analyze it.
 */
const fetch = require('node-fetch');
const Groq = require('groq-sdk');

const AGENT_DAEMON_URL = 'http://127.0.0.1:3002';

/**
 * Analyzes the current screen using the local Gemma 4 Agent Daemon.
 * @param {string} question - What ZAIRE should look for on the screen
 * @param {string} context - Optional context for the agent
 * @returns {string} - ZAIRE's description of what he sees
 */
async function analyzeScreen(question = 'What is on the screen?', context = 'Standard user query') {
  const maxRetries = 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[VISION] Routing request to Agent sidecar (Attempt ${attempt + 1})...`);
      const res = await fetch(`${AGENT_DAEMON_URL}/agent/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question, context }),
        timeout: 30000 
      });
      
      if (res.status === 404) {
        console.warn('[VISION] Agent returned 404. Verifying sidecar health...');
        const health = await fetch(`${AGENT_DAEMON_URL}/health`).catch(() => ({ ok: false }));
        if (!health.ok) throw new Error("Agent daemon is not responding correctly.");
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      console.log('[VISION] Analysis complete.');
      return text.trim() || "I've analyzed the screen, sir, but found nothing of note.";
      
    } catch (e) {
      lastError = e;
      console.warn(`[VISION] Attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
      }
    }
  }

  console.error('[VISION] All vision attempts failed:', lastError.message);
  return `The visual core is momentarily offline: ${lastError.message}`;
}

module.exports = { analyzeScreen };

