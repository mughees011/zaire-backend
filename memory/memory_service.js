/**
 * Memory Service — ZAIRE Persistent Memory
 * Stores facts across sessions in a local JSON file.
 * Uses keyword scoring to recall relevant memories.
 */
const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory', 'zaire_memory.json');
const VISUAL_ECHO_FILE = path.join(__dirname, 'memory', 'visual_echo.json');
const MAX_MEMORIES = 200; // Keep the last 200 facts stored
const MAX_VISUAL_LOGS = 50; // Keep roughly ~4 hours of dense visual history

// ─── File Helpers ──────────────────────────────────────────────────────────────

function loadMemories() {
  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.memories) ? parsed.memories : [];
  } catch (e) {
    return [];
  }
}

function saveMemories(memories) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ memories }, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[MEMORY] Failed to save:', e.message);
    return false;
  }
}

// ─── Core Functions ────────────────────────────────────────────────────────────

function determineCategory(text) {
  const t = text.toLowerCase();
  if (t.includes('code') || t.includes('javascript') || t.includes('python') || t.includes('bug') || t.includes('api')) return 'code';
  if (t.includes('buy') || t.includes('sell') || t.includes('trade') || t.includes('crypto') || t.includes('market')) return 'finance';
  if (t.includes('study') || t.includes('learn') || t.includes('read') || t.includes('understand')) return 'study';
  if (t.includes('like') || t.includes('prefer') || t.includes('hate') || t.includes('always') || t.includes('my')) return 'preference';
  return 'general';
}

function calculateImportance(text) {
  let score = 3; // base out of 10
  const t = text.toLowerCase();
  if (t.includes('always') || t.includes('never') || t.includes('critical') || t.includes('must')) score += 4;
  if (t.includes('prefer') || t.includes('like') || t.includes('hate')) score += 2;
  if (t.includes('important') || t.includes('remember')) score += 3;
  if (text.length > 50) score += 1;
  return Math.min(score, 10);
}

/**
 * Store a new fact in persistent memory.
 * @param {string} text - The fact or preference to remember
 * @returns {{ success: boolean, count: number }}
 */
function rememberFact(text) {
  if (!text || text.trim().length < 3) {
    return { success: false, error: 'Memory too short to store.' };
  }

  const memories = loadMemories();
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    text: text.trim(),
    category: determineCategory(text.trim()),
    importance: calculateImportance(text.trim()),
    // Simple keyword tags extracted for faster recall
    tags: extractKeywords(text.trim())
  };

  memories.unshift(entry); // newest first

  // Trim to max capacity
  if (memories.length > MAX_MEMORIES) memories.splice(MAX_MEMORIES);

  const saved = saveMemories(memories);
  console.log(`[MEMORY] Stored: "${text.trim()}" (cat: ${entry.category}, imp: ${entry.importance}) (total: ${memories.length})`);
  return { success: saved, count: memories.length, id: entry.id };
}

/**
 * Recall memories relevant to a query using keyword scoring.
 * Returns top N most relevant memories as formatted strings.
 * @param {string} query - The user's question or context
 * @param {number} topN - How many memories to return (default 5)
 * @returns {string[]} - Array of relevant memory strings
 */
function recallMemories(query = '', topN = 5) {
  const memories = loadMemories();
  if (memories.length === 0) return [];

  if (!query.trim()) {
    // No query — return most recent N memories
    return memories.slice(0, topN).map(m => m.text);
  }

  const queryWords = extractKeywords(query);

  // Score each memory by keyword overlap
  const scored = memories.map(m => {
    const overlap = m.tags.filter(tag => queryWords.some(qw =>
      m.text.toLowerCase().includes(qw) || qw.includes(tag)
    )).length;

    // Recency bonus (newer memories score slightly higher)
    const ageMs = Date.now() - m.id;
    const recencyBonus = Math.max(0, 1 - ageMs / (30 * 24 * 60 * 60 * 1000)); // decays over 30 days

    return { memory: m, score: overlap + recencyBonus * 0.3 };
  });

  // Sort by score, return top N
  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.memory.text);

  // If nothing matched, return the 3 most recent as context
  if (relevant.length === 0) return memories.slice(0, 3).map(m => m.text);

  return relevant;
}

/**
 * Search all stored memories and return full memory objects.
 * Used by the Memory Dashboard/Viewer.
 * @param {string} query - The search string
 * @returns {{ id, timestamp, text, category, importance }[]}
 */
function searchMemories(query = '') {
  const memories = loadMemories();
  if (!query.trim()) return memories;

  const queryWords = extractKeywords(query);

  const scored = memories.map(m => {
    const overlap = m.tags.filter(tag => queryWords.some(qw =>
      m.text.toLowerCase().includes(qw) || qw.includes(tag)
    )).length;
    return { memory: m, score: overlap };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.memory);
}

/**
 * Get all stored memories (for display in the UI).
 * @returns {{ id, timestamp, text, category, importance }[]}
 */
function getAllMemories(limit = 20) {
  const memories = loadMemories();
  return memories.slice(0, limit).map(({ id, timestamp, text, category, importance }) => ({ 
    id, timestamp, text, category: category || 'general', importance: importance || 3 
  }));
}

/**
 * Delete a specific memory by ID.
 * @param {number} id - Memory ID to delete
 */
function forgetMemory(id) {
  const memories = loadMemories();
  const filtered = memories.filter(m => m.id !== id);
  saveMemories(filtered);
  return { success: true, removed: memories.length - filtered.length };
}

/**
 * Persist a technical screen observation (Gaze Memory).
 * @param {string} summary - The technical summary of the screen
 */
function persistVisualEcho(summary) {
  if (!summary || summary.length < 5) return;

  let echoes = [];
  try {
    if (fs.existsSync(VISUAL_ECHO_FILE)) {
      echoes = JSON.parse(fs.readFileSync(VISUAL_ECHO_FILE, 'utf-8'));
    }
  } catch (e) { }

  const entry = {
    timestamp: new Date().toISOString(),
    content: summary.trim()
  };

  echoes.unshift(entry);

  // Prune entries older than 24 hours OR exceed limit
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  echoes = echoes.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);
  if (echoes.length > MAX_VISUAL_LOGS) echoes.splice(MAX_VISUAL_LOGS);

  try {
    fs.writeFileSync(VISUAL_ECHO_FILE, JSON.stringify(echoes, null, 2));
  } catch (e) {
    console.error('[MEMORY] Visual Echo Save Failed:', e.message);
  }
}

/**
 * Retrieves latest visual history as context.
 */
function getVisualEchoContext() {
  try {
    if (!fs.existsSync(VISUAL_ECHO_FILE)) return "";
    const echoes = JSON.parse(fs.readFileSync(VISUAL_ECHO_FILE, 'utf-8'));
    if (echoes.length === 0) return "";

    const lines = echoes.slice(0, 10).map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      return `[${time}] ${e.content}`;
    }).reverse().join('\n');

    return `\n\n[GAZE MEMORY — Chronological history of what you observed on Mughees's screen recently:]\n${lines}`;
  } catch (e) {
    return "";
  }
}

/**
 * Build a context string to inject into the ZAIRE system prompt.
 * Called on every conversation turn.
 * @param {string} currentQuery - The user's current message
 * @returns {string} - Ready-to-inject memory context block
 */
function buildMemoryContext(currentQuery = '') {
  const relevant = recallMemories(currentQuery, 5);
  const facts = relevant.length > 0
    ? `\n\n[ZAIRE LONG-TERM MEMORY — Facts you know about the user from past sessions:]\n${relevant.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  const gaze = getVisualEchoContext();

  return facts + gaze;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'my', 'me',
  'we', 'you', 'your', 'it', 'its', 'this', 'that', 'and', 'or', 'but', 'in', 'on',
  'at', 'to', 'for', 'of', 'with', 'he', 'she', 'they', 'be', 'do', 'have', 'had',
  'has', 'will', 'would', 'could', 'should', 'can', 'may', 'what', 'when', 'where',
  'how', 'why', 'who']);

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

module.exports = { rememberFact, recallMemories, getAllMemories, forgetMemory, buildMemoryContext, persistVisualEcho, searchMemories };
