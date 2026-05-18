const pool = require('./db');
const { encrypt, decrypt, maskKey } = require('./crypto_utils');

/**
 * Saves or updates encrypted keys for a given user
 * @param {string} userId - The Clerk User ID
 * @param {object} keys - Raw credentials object { groq_key, openai_key, gemini_key, openrouter_key }
 * @returns {object} - The masked database status map
 */
async function saveUserKeys(userId, keys) {
  try {
    // Fetch existing vault record to do partial updates
    const existingResult = await pool.query(
      'SELECT * FROM user_vault WHERE user_id = $1',
      [userId]
    );
    const existing = existingResult.rows[0];

    // Encrypt only if key is provided, otherwise preserve existing encrypted block
    const groq_enc = keys.groq_key !== undefined ? encrypt(keys.groq_key) : (existing ? existing.groq_key : null);
    const openai_enc = keys.openai_key !== undefined ? encrypt(keys.openai_key) : (existing ? existing.openai_key : null);
    const gemini_enc = keys.gemini_key !== undefined ? encrypt(keys.gemini_key) : (existing ? existing.gemini_key : null);
    const openrouter_enc = keys.openrouter_key !== undefined ? encrypt(keys.openrouter_key) : (existing ? existing.openrouter_key : null);

    if (existing) {
      // Perform database UPDATE
      await pool.query(
        `
        UPDATE user_vault
        SET
          groq_key = $1,
          openai_key = $2,
          gemini_key = $3,
          openrouter_key = $4,
          updated_at = NOW()
        WHERE user_id = $5
        `,
        [groq_enc, openai_enc, gemini_enc, openrouter_enc, userId]
      );
    } else {
      // Perform database INSERT
      await pool.query(
        `
        INSERT INTO user_vault
        (user_id, groq_key, openai_key, gemini_key, openrouter_key)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [userId, groq_enc, openai_enc, gemini_enc, openrouter_enc]
      );
    }

    console.log(`[VAULT] Successfully secured credentials for user: ${userId}`);
    return await getKeyStatus(userId);
  } catch (err) {
    console.error('[VAULT ERR] Failed to save keys:', err.message);
    throw new Error('Vault write operation failed.');
  }
}

/**
 * Fetches and decrypts credentials for raw server-side ingestion (e.g. for feeding Groq/Gemini SDKs)
 * @param {string} userId - The Clerk User ID
 * @returns {object} - Decrypted raw credentials map { groq_key, openai_key, gemini_key, openrouter_key }
 */
async function getUserKeys(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_vault WHERE user_id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      return { groq_key: null, openai_key: null, gemini_key: null, openrouter_key: null };
    }

    return {
      groq_key: decrypt(row.groq_key),
      openai_key: decrypt(row.openai_key),
      gemini_key: decrypt(row.gemini_key),
      openrouter_key: decrypt(row.openrouter_key)
    };
  } catch (err) {
    console.error('[VAULT ERR] Failed to decrypt keys:', err.message);
    throw new Error('Vault read/decryption failed.');
  }
}

/**
 * Exposes ONLY a masked status blueprint to frontend calls to verify credentials safely
 * @param {string} userId - The Clerk User ID
 * @returns {object} - Status map containing booleans and masked key segments
 */
async function getKeyStatus(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_vault WHERE user_id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      return {
        groq: { configured: false, mask: null },
        openai: { configured: false, mask: null },
        gemini: { configured: false, mask: null },
        openrouter: { configured: false, mask: null }
      };
    }

    // Decrypt key temporarily just to generate mask, then wipe memory
    const rawGroq = decrypt(row.groq_key);
    const rawOpenAI = decrypt(row.openai_key);
    const rawGemini = decrypt(row.gemini_key);
    const rawOpenRouter = decrypt(row.openrouter_key);

    return {
      groq: { configured: !!rawGroq, mask: maskKey(rawGroq) },
      openai: { configured: !!rawOpenAI, mask: maskKey(rawOpenAI) },
      gemini: { configured: !!rawGemini, mask: maskKey(rawGemini) },
      openrouter: { configured: !!rawOpenRouter, mask: maskKey(rawOpenRouter) }
    };
  } catch (err) {
    console.error('[VAULT ERR] Failed to assemble key status:', err.message);
    throw new Error('Vault status request failed.');
  }
}

module.exports = {
  saveUserKeys,
  getUserKeys,
  getKeyStatus
};
