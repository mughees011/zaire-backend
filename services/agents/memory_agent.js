/**
 * ZAIRE Engineer Memory Agent
 *
 * Manages Persistent Memory & Context for the Engineer Mode.
 * Reads from and writes to the existing `memories`, `user_settings`,
 * and `architecture_plans` tables — no new schema required.
 *
 * Functions:
 *   loadEngineerContext(userId, db)       → Load user history before plan generation
 *   buildContextPrompt(contextBlock)      → Convert memory into an LLM system prompt
 *   saveEngineerMemory(...)               → Persist learned facts after plan completion
 *   updateUserPreferences(userId, prefs)  → Explicit preference upsert from user actions
 */

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const MEMORY_CATEGORY = 'engineer';
const MAX_PAST_PROJECTS = 3;
const MAX_MEMORIES_LOADED = 20;

// Memory fact categories (written to the `memories.category` column)
const FACT_TYPES = {
  TECH:       'tech_preference',
  DESIGN:     'design_preference',
  DEPLOYMENT: 'deployment_preference',
  PATTERN:    'project_pattern',
  EXPLICIT:   'explicit_note'
};

// ── LOAD CONTEXT ──────────────────────────────────────────────────────────────

/**
 * Loads all relevant memory for a user before plan generation.
 * Gracefully returns an empty context if the DB is unavailable.
 *
 * @param {string} userId
 * @param {Object} db - pg Pool instance
 * @returns {Object} contextBlock
 */
async function loadEngineerContext(userId, db) {
  const empty = {
    userId,
    preferences: {},
    memories: [],
    pastProjects: [],
    hasMemory: false
  };

  if (!db || !userId || userId === 'local-user') return empty;

  try {
    // 1. Load structured preferences from user_settings.agent_settings
    const settingsRes = await db.query(
      `SELECT agent_settings FROM user_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const preferences = settingsRes.rows[0]?.agent_settings || {};

    // 2. Load engineer-specific memories, highest importance first
    const memoriesRes = await db.query(
      `SELECT id, text, category, importance, source, created_at
       FROM memories
       WHERE user_id = $1 AND category LIKE $2
       ORDER BY importance DESC, created_at DESC
       LIMIT $3`,
      [userId, `${MEMORY_CATEGORY}%`, MAX_MEMORIES_LOADED]
    );
    const memories = memoriesRes.rows;

    // 3. Load past architecture plans for pattern recognition
    const historyRes = await db.query(
      `SELECT p.name, p.type, p.scope, p.deployment_target, ap.tech_stack, ap.summary, ap.created_at
       FROM projects p
       LEFT JOIN architecture_plans ap ON ap.project_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [userId, MAX_PAST_PROJECTS]
    );
    const pastProjects = historyRes.rows;

    const hasMemory = memories.length > 0 || pastProjects.length > 0 || Object.keys(preferences).length > 0;

    console.log(`[MEMORY AGENT] Loaded context for ${userId}: ${memories.length} memories, ${pastProjects.length} past projects.`);

    return { userId, preferences, memories, pastProjects, hasMemory };

  } catch (err) {
    console.warn('[MEMORY AGENT] Could not load context (DB may be offline):', err.message);
    return empty;
  }
}

// ── BUILD CONTEXT PROMPT ──────────────────────────────────────────────────────

/**
 * Converts the loaded contextBlock into a rich text block that is prepended
 * to the architecture LLM system prompt.
 *
 * @param {Object} contextBlock - from loadEngineerContext
 * @returns {string} A formatted string to inject into the system prompt
 */
function buildContextPrompt(contextBlock) {
  if (!contextBlock?.hasMemory) return '';

  const lines = [
    '─────────────────────────────────────────',
    'ZAIRE PERSISTENT MEMORY — USER CONTEXT',
    '─────────────────────────────────────────',
    'The following is what ZAIRE remembers about this user from past sessions.',
    'Use this to personalize your output — pre-fill preferences, avoid repeated questions,',
    'and make smarter default decisions.',
    ''
  ];

  // User preferences block
  const prefs = contextBlock.preferences || {};
  if (Object.keys(prefs).length > 0) {
    lines.push('USER PREFERENCES (from settings):');
    if (prefs.preferredStack)       lines.push(`  • Preferred stack: ${prefs.preferredStack}`);
    if (prefs.preferredColorMode)   lines.push(`  • Color mode: ${prefs.preferredColorMode}`);
    if (prefs.preferredDeployment)  lines.push(`  • Deployment target: ${prefs.preferredDeployment}`);
    if (prefs.preferredFont)        lines.push(`  • Font preference: ${prefs.preferredFont}`);
    if (prefs.preferredORM)         lines.push(`  • ORM preference: ${prefs.preferredORM}`);
    if (prefs.avoidedTech)          lines.push(`  • Technologies to AVOID: ${prefs.avoidedTech}`);
    lines.push('');
  }

  // Memory facts block
  if (contextBlock.memories?.length > 0) {
    lines.push('LEARNED FACTS (from past projects):');
    contextBlock.memories.forEach(m => {
      lines.push(`  [${m.category}] ${m.text}`);
    });
    lines.push('');
  }

  // Past projects block
  if (contextBlock.pastProjects?.length > 0) {
    lines.push('RECENT PROJECT HISTORY:');
    contextBlock.pastProjects.forEach((p, i) => {
      const stack = Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : (p.tech_stack || 'unknown');
      lines.push(`  ${i + 1}. "${p.name}" — ${p.type || 'Web App'}, ${p.scope || 'unknown scope'}, deployed to ${p.deployment_target || 'unknown'}`);
      if (p.summary) lines.push(`     Summary: ${p.summary}`);
    });
    lines.push('');
  }

  lines.push('─────────────────────────────────────────');
  lines.push('');

  return lines.join('\n');
}

// ── SAVE ENGINEER MEMORY ──────────────────────────────────────────────────────

/**
 * Extracts facts from a completed plan and saves them to the memories table.
 * Called as a fire-and-forget background task — never blocks the API response.
 *
 * @param {string} userId
 * @param {string|null} projectId
 * @param {Object} planData - the returned plan from buildEngineerPlan
 * @param {Object} intakeData - the original user intake
 * @param {Object} db - pg Pool instance
 */
async function saveEngineerMemory(userId, projectId, planData, intakeData, db) {
  if (!db || !userId || userId === 'local-user') return;

  const factsToSave = [];

  // --- Tech stack preference ---
  if (planData.stack?.length) {
    const stackSummary = planData.stack.slice(0, 5).join(', ');
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.TECH}`,
      text: `User built a project using: ${stackSummary}`,
      importance: 3,
      source: 'auto-detected'
    });
  }

  // --- Deployment preference ---
  if (intakeData.deploymentTarget) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.DEPLOYMENT}`,
      text: `User deployed to ${intakeData.deploymentTarget}`,
      importance: 4,
      source: 'auto-detected'
    });
  }

  // --- Feature patterns ---
  if (planData.needsAuth) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.PATTERN}`,
      text: `User enabled authentication (Clerk) in this project`,
      importance: 2,
      source: 'auto-detected'
    });
  }
  if (planData.needsDatabase) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.PATTERN}`,
      text: `User required a database (PostgreSQL + Prisma) in this project`,
      importance: 2,
      source: 'auto-detected'
    });
  }
  if (planData.needsPayments) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.PATTERN}`,
      text: `User enabled Stripe payments in this project`,
      importance: 2,
      source: 'auto-detected'
    });
  }

  // --- Design preferences from Vision Agent ---
  if (planData.designIntelligence?.mode) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.DESIGN}`,
      text: `User's reference image showed a ${planData.designIntelligence.mode} mode, ${planData.designIntelligence.personality} design (${planData.designIntelligence.era} era)`,
      importance: 3,
      source: 'vision-agent'
    });
  }
  if (planData.designIntelligence?.typography?.displayFont) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.DESIGN}`,
      text: `User's reference used "${planData.designIntelligence.typography.displayFont}" as the display font`,
      importance: 2,
      source: 'vision-agent'
    });
  }

  // --- Project type pattern ---
  if (planData.projectTypeLabel) {
    factsToSave.push({
      category: `${MEMORY_CATEGORY}:${FACT_TYPES.PATTERN}`,
      text: `User built a ${planData.projectTypeLabel} for: ${intakeData.who || 'unknown audience'}`,
      importance: 2,
      source: 'auto-detected'
    });
  }

  // Batch insert all facts
  try {
    for (const fact of factsToSave) {
      await db.query(
        `INSERT INTO memories (user_id, project_id, text, category, importance, source)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, projectId || null, fact.text, fact.category, fact.importance, fact.source]
      );
    }
    console.log(`[MEMORY AGENT] Saved ${factsToSave.length} memory facts for user ${userId}.`);
  } catch (err) {
    console.warn('[MEMORY AGENT] Failed to save memories (non-fatal):', err.message);
  }
}

// ── UPDATE USER PREFERENCES ───────────────────────────────────────────────────

/**
 * Upserts structured user preferences into user_settings.agent_settings.
 * Called when a user explicitly changes a setting in the UI.
 *
 * @param {string} userId
 * @param {Object} newPrefs - Partial preferences object to merge
 * @param {Object} db - pg Pool instance
 */
async function updateUserPreferences(userId, newPrefs, db) {
  if (!db || !userId) return false;

  try {
    await db.query(
      `INSERT INTO user_settings (user_id, agent_settings, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         agent_settings = user_settings.agent_settings || $2::jsonb,
         updated_at = NOW()`,
      [userId, JSON.stringify(newPrefs)]
    );
    console.log(`[MEMORY AGENT] Updated preferences for user ${userId}:`, Object.keys(newPrefs));
    return true;
  } catch (err) {
    console.warn('[MEMORY AGENT] Failed to update preferences:', err.message);
    return false;
  }
}

// ── INTAKE ENRICHMENT ─────────────────────────────────────────────────────────

/**
 * Fills in blank intake fields from the user's memory.
 * If the user didn't specify a deployment target but always uses Vercel,
 * this function silently pre-fills it so the plan is more accurate.
 *
 * @param {Object} intake - the raw intake from the request body
 * @param {Object} contextBlock - from loadEngineerContext
 * @returns {Object} enriched intake
 */
function enrichIntakeFromMemory(intake, contextBlock) {
  if (!contextBlock?.hasMemory) return intake;

  const enriched = { ...intake };
  const prefs = contextBlock.preferences || {};

  // Only fill in fields the user left blank
  if (!enriched.deploymentTarget && prefs.preferredDeployment) {
    enriched.deploymentTarget = prefs.preferredDeployment;
    console.log(`[MEMORY AGENT] Pre-filled deploymentTarget from memory: ${prefs.preferredDeployment}`);
  }

  // Infer deployment target from past project patterns if still missing
  if (!enriched.deploymentTarget && contextBlock.pastProjects?.length > 0) {
    const targets = contextBlock.pastProjects
      .map(p => p.deployment_target)
      .filter(Boolean);
    if (targets.length > 0) {
      // Use the most common past target
      const freq = targets.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
      const mostCommon = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      enriched.deploymentTarget = mostCommon;
      console.log(`[MEMORY AGENT] Inferred deploymentTarget from project history: ${mostCommon}`);
    }
  }

  return enriched;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  loadEngineerContext,
  buildContextPrompt,
  saveEngineerMemory,
  updateUserPreferences,
  enrichIntakeFromMemory,
  FACT_TYPES,
  MEMORY_CATEGORY
};
