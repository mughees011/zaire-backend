const pool = require('../db/db');
const { encrypt, decrypt, maskKey } = require('../security/crypto_utils');

/**
 * Validates that a raw API key's format is consistent with its declared provider.
 * Throws if it detects a mismatch so the error surfaces at save-time, not at LLM call-time.
 * @param {string} provider - Provider name (e.g. 'Groq', 'OpenAI', 'Anthropic')
 * @param {string} rawKey   - The plaintext key to validate
 */
function validateKeyFormatOnSave(provider, rawKey) {
  if (!rawKey) return; // Empty = no key being changed, nothing to validate.
  const p = String(provider || '').trim().toLowerCase();
  const k = String(rawKey || '').trim();

  const FORMAT_RULES = [
    { providers: ['groq'],               prefix: 'gsk_',    label: 'Groq' },
    { providers: ['openai', 'azure openai'], prefix: 'sk-', label: 'OpenAI' },
    { providers: ['anthropic'],          prefix: 'sk-ant-', label: 'Anthropic' },
  ];

  for (const rule of FORMAT_RULES) {
    if (rule.providers.includes(p)) {
      if (!k.startsWith(rule.prefix)) {
        throw new Error(
          `${rule.label} keys must start with "${rule.prefix}". ` +
          `The key you provided doesn't match — check you copied the correct key from ${rule.label}'s dashboard.`
        );
      }
      return;
    }
  }

  // For all other providers, enforce a small minimum length to catch empty/obvious pastes, 
  // but allow short keys for local/custom providers (e.g. 'ollama').
  if (k.length < 3) {
    throw new Error(
      `The key for ${provider} looks too short (${k.length} chars). ` +
      `Please paste the full API key from your provider's dashboard.`
    );
  }
}

/**
 * Saves or updates encrypted keys for a given user as slots
 * @param {string} userId - The Clerk User ID
 * @param {Array} slots - Array of slot objects: { slot, provider, key, model, purpose, baseUrl, enabled }
 * @returns {Array} - The masked database status map
 */
async function saveUserKeys(userId, slots) {
  try {
    for (const s of slots) {
      if (s.slot === undefined) continue;

      // Ensure model is valid
      if (s.enabled && s.provider !== 'Empty' && !s.model) {
        throw new Error('Empty model is invalid for an enabled provider.');
      }

      // Check if slot exists
      const existingResult = await pool.query(
        'SELECT * FROM ai_vault_slots WHERE user_id = $1 AND slot = $2',
        [userId, s.slot]
      );
      const existing = existingResult.rows[0];

      // Encrypt only if key is provided, otherwise preserve existing encrypted block
      let encKey = existing ? existing.encrypted_api_key : null;
      let hasKey = existing ? existing.has_key : false;
      const existingProvider = existing ? String(existing.provider || '') : '';
      const nextProvider = String(s.provider || '');
      const providerChanged = existing && existingProvider.toLowerCase() !== nextProvider.toLowerCase();

      if (s.key) {
        // Validate key format before encrypting — surface mismatch errors immediately.
        validateKeyFormatOnSave(s.provider, s.key);
        encKey = encrypt(s.key);
        hasKey = true;
      } else if (!s.enabled || nextProvider === 'Empty' || providerChanged) {
        encKey = null;
        hasKey = false;
      }

      if (existing) {
        await pool.query(
          `
          UPDATE ai_vault_slots
          SET
            provider = COALESCE($1, provider),
            encrypted_api_key = $2,
            has_key = $3,
            model = COALESCE($4, model),
            purpose = COALESCE($5, purpose),
            base_url = COALESCE($6, base_url),
            enabled = COALESCE($7, enabled),
            updated_at = NOW()
          WHERE user_id = $8 AND slot = $9
          `,
          [s.provider, encKey, hasKey, s.model, s.purpose, s.baseUrl, s.enabled, userId, s.slot]
        );
      } else {
        await pool.query(
          `
          INSERT INTO ai_vault_slots
          (user_id, slot, provider, encrypted_api_key, has_key, model, purpose, base_url, enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [userId, s.slot, s.provider, encKey, hasKey, s.model, s.purpose, s.baseUrl, s.enabled]
        );
      }
    }

    console.log(`[VAULT] Successfully secured credentials for user: ${userId}`);
    return await getKeyStatus(userId);
  } catch (err) {
    console.error('[VAULT ERR] Failed to save keys:', err.message);
    throw new Error('Vault write operation failed.');
  }
}

/**
 * Fetches and decrypts credentials for raw server-side ingestion
 * @param {string} userId - The Clerk User ID
 * @returns {Array} - Array of slots with decrypted keys
 */
async function getUserKeys(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_vault_slots WHERE user_id = $1 ORDER BY slot ASC',
      [userId]
    );
    
    return result.rows.map(row => ({
      slot: row.slot,
      provider: row.provider,
      key: row.encrypted_api_key ? decrypt(row.encrypted_api_key) : null,
      model: row.model,
      purpose: row.purpose,
      baseUrl: row.base_url,
      enabled: row.enabled
    }));
  } catch (err) {
    console.error('[VAULT ERR] Failed to decrypt keys:', err.message);
    throw new Error('Vault read/decryption failed.');
  }
}

/**
 * Exposes ONLY a masked status blueprint to frontend calls to verify credentials safely
 * @param {string} userId - The Clerk User ID
 * @returns {Array} - Array of slot statuses containing masked key segments
 */
async function getKeyStatus(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_vault_slots WHERE user_id = $1 ORDER BY slot ASC',
      [userId]
    );
    
    return result.rows.map(row => {
      let mask = null;
      if (row.encrypted_api_key) {
         try {
           mask = maskKey(decrypt(row.encrypted_api_key));
         } catch(e) {}
      }

      return {
        slot: row.slot,
        provider: row.provider,
        hasKey: row.has_key,
        mask: mask,
        model: row.model,
        purpose: row.purpose,
        baseUrl: row.base_url,
        enabled: row.enabled,
        updatedAt: row.updated_at
      };
    });
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
