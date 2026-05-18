const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { analyzeScreen } = require('./vision_service');
const { persistVisualEcho } = require('./memory_service');

/**
 * ProactiveService
 * Responsible for background monitoring of external APIs.
 * Triggers socket events when "Neural Interrupts" are required.
 */
class ProactiveService {
  constructor(socketClient, groqClient, interruptHandler) {
    this.socket = socketClient;
    this.groq = groqClient;
    this.interruptHandler = interruptHandler;
    this.monitorInterval = null;
    this.lastPrices = {};
    this.watchedStocks = ['TSLA', 'NVDA', 'BTC-USD'];
    this.isMonitoring = false;
    this.cycleCount = 0;
    this.V_ECHO_INTERVAL = 5 * 60 * 1000; // 5 Minutes
    this.SENTINEL_INTERVAL = 2 * 60 * 1000; // 2 Minutes
    this.AGENT_URL = 'http://127.0.0.1:3002';
    this.lastInterruptTime = 0;
  }

  async start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    console.log('[PROACTIVE] Intelligence monitoring active.');

    // Stock/Screen Observation Cycle (5 mins)
    this.monitorInterval = setInterval(() => this.cycle(), 5 * 60 * 1000);

    // Gaze Memory Sync (Independent 5 min loop)
    this.visualEchoInterval = setInterval(() => this.checkVisualEcho(), this.V_ECHO_INTERVAL);

    // Environment Sentinel (Independent 2 min loop)
    this.sentinelInterval = setInterval(() => this.sentinelCycle(), this.SENTINEL_INTERVAL);

    this.cycle(); // Initial stock run
    this.checkVisualEcho(); // Initial gaze capture
    this.sentinelCycle(); // Initial health check
  }

  async cycle() {
    console.log('[PROACTIVE] Periodic sensor cycle initiated...');
    try {
      await this.checkStocks();
      // Only check screen every 2nd cycle (~10 mins) to avoid being too talkative
      this.cycleCount++;
      if (this.cycleCount % 2 === 0) {
        await this.checkScreen();
      }
    } catch (err) {
      console.error('[PROACTIVE] Cycle error:', err.message);
    }
  }

  async checkScreen() {
    console.log('[PROACTIVE] Glancing at screen...');
    try {
      const observation = await analyzeScreen("Give a very brief, witty observation about what the user is currently doing on their screen. If it's code, be encouraging. If it's a website, be curious.");
      if (observation && !observation.includes('offline') && !observation.includes('unresponsive')) {
        await this.triggerInterrupt(observation);
      }
    } catch (e) {
      console.warn(`[PROACTIVE] Screen glance failed: ${e.message}`);
    }
  }

  async checkVisualEcho() {
    console.log('[PROACTIVE] Syncing Gaze Memory (Visual Echo)...');
    try {
      const technicalSummary = await analyzeScreen(
        "Sir, describe the current technical activity on the master's screen in one very concise sentence. " +
        "Focus on: Active application title, visible code file/function, open browser tabs, or development terminal output. " +
        "Example: 'Master is editing engineer.py in VS Code while monitoring npm start in a terminal.' or 'Master is researching ArXiv paper on Transformers in Chrome.'"
      );

      if (technicalSummary && !technicalSummary.includes('offline')) {
        persistVisualEcho(technicalSummary);
        console.log('[PROACTIVE] Visual Echo persisted to long-term memory.');
      }
    } catch (e) {
      console.error('[PROACTIVE] Visual Echo failed:', e.message);
    }
  }

  async checkStocks() {
    for (const symbol of this.watchedStocks) {
      try {
        const result = await yahooFinance.quoteSummary(symbol, { modules: ['price'] });
        const price = result.price?.regularMarketPrice;

        if (price && this.lastPrices[symbol]) {
          const change = ((price - this.lastPrices[symbol]) / this.lastPrices[symbol]) * 100;

          if (Math.abs(change) >= 2) {
            await this.triggerInterrupt(`Sir, ${symbol} has moved ${change.toFixed(2)}%. Current price is $${price}.`);
          }
        }
        if (price) this.lastPrices[symbol] = price;
      } catch (e) {
        console.warn(`[PROACTIVE] Could not fetch ${symbol}: ${e.message}`);
      }
    }
  }

  /**
   * Proactive Clipboard Intervention
   */
  async handleClipboardEvent(event) {
    console.log('[PROACTIVE] Handling clipboard event...');

    // Cooldown check (don't interrupt more than once every 30s for the same thing)
    const now = Date.now();
    if (this.lastInterruptTime && (now - this.lastInterruptTime < 30000)) return;

    if (event.type === 'code') {
      const summary = `Sir, I noticed you copied a block of ${event.length} characters of code. Would you like me to perform a neural review or suggest optimizations?`;
      await this.triggerInterrupt(summary);
      this.lastInterruptTime = now;
    }
    else if (event.type === 'url' && event.title) {
      const summary = `Sir, I've analyzed that URL you just copied: "${event.title}". It seems relevant to your work. Shall I keep it in your research stack?`;
      await this.triggerInterrupt(summary);
      this.lastInterruptTime = now;
    }
  }

  /**
   * Proactive File Intervention
   */
  async handleFileEvent(event) {
    console.log('[PROACTIVE] Handling file event:', event.filename);

    // Cooldown check
    const now = Date.now();
    if (this.lastInterruptTime && (now - this.lastInterruptTime < 20000)) return;

    let summary = "";
    if (event.category === 'study') {
      summary = `Sir, a new study document has appeared: "${event.filename}". I've already added it to your Professor study queue. Would you like to begin a session now?`;
    } else if (event.category === 'code') {
      summary = `Sir, you've saved a new code file: "${event.filename}". Shall I manifest it in the Engineer Forge for structural analysis?`;
    } else if (event.category === 'image') {
      summary = `Sir, I noticed a new image: "${event.filename}". My visual cortex is ready to describe its contents if you require.`;
    }

    if (summary) {
      await this.triggerInterrupt(summary);
      this.lastInterruptTime = now;
    }
  }

  /**
   * Triggers ZAIRE to speak without being prompted.
   */
  async triggerInterrupt(summary, urgency = "normal") {
    console.log('[PROACTIVE] TRIGGERING INTERRUPT:', summary);

    const systemPrompt = urgency === "urgent"
      ? "You are ZAIRE. This is a SECURITY/SYSTEM ALERT for Mughees. Be incredibly concise, professional, and slightly urgent. No markdown."
      : "You are ZAIRE. You are providing a proactive system update to Mughees. Be concise, witty, and Stark-like. No markdown. Mention it's a proactive update.";

    // We use the 70B model for high-fidelity background "thoughts"
    let zaireSpeech = summary;
    if (this.groq) {
      const response = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: summary }
        ],
        model: 'llama-3.3-70b-versatile',
      });
      zaireSpeech = response.choices[0].message.content;
    }

    if (this.interruptHandler) {
      this.interruptHandler({
        text: zaireSpeech,
        type: urgency === "urgent" ? 'SECURITY_ALERT' : 'PROACTIVE_ALERT'
      });
    } else {
      this.socket.emit('neural_interrupt', {
        text: zaireSpeech,
        type: urgency === "urgent" ? 'SECURITY_ALERT' : 'PROACTIVE_ALERT'
      });
    }
  }

  async sentinelCycle() {
    console.log('[SENTINEL] Running diagnostic heartbeat...');
    try {
      const healthRes = await fetch(`${this.AGENT_URL}/system/health_sentinel`).then(r => r.json()).catch(() => ({ success: false }));
      const gitRes = await fetch(`${this.AGENT_URL}/git/sentinel_status`).then(r => r.json()).catch(() => ({ success: false }));

      if (!healthRes || !healthRes.success) return;

      // 1. Hardware Threshold Checks
      if (healthRes.cpu_percent > 85) {
        const audit = await fetch(`${this.AGENT_URL}/system/resource_audit`).then(r => r.json());
        const topApp = audit.top_processes?.[0]?.name || "a background process";
        await this.triggerInterrupt(`Sir, CPU usage is reaching critical levels at ${healthRes.cpu_percent}%. ${topApp} is consuming the most resources. Shall I terminate it?`, "urgent");
      } else if (healthRes.ram.percent > 95) {
        await this.triggerInterrupt(`Sir, system memory is exhausted at ${healthRes.ram.percent}%. Core stability may be compromised.`, "urgent");
      }

      // 2. Git/Workflow Integrity
      if (gitRes.success && gitRes.status === "dirty" && gitRes.change_count > 10) {
        await this.triggerInterrupt(`Sir, I notice your ${gitRes.branch} branch has ${gitRes.change_count} uncommitted changes. To maintain architectural purity, I recommend a synchronization commit.`);
      }

    } catch (e) {
      console.error('[SENTINEL] Diagnostic failure:', e.message);
    }
  }

  stop() {
    clearInterval(this.monitorInterval);
    clearInterval(this.visualEchoInterval);
    clearInterval(this.sentinelInterval);
    this.isMonitoring = false;
  }
}

module.exports = ProactiveService;
