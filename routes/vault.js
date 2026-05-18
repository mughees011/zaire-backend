const express = require('express');
const { requireAuth } = require('../auth_middleware');
const { saveUserKeys, getKeyStatus } = require('../vault_service');

const router = express.Router();

/**
 * POST /api/vault/save
 * Safely saves or updates user API keys. Performs AES-256 encryption server-side.
 * Expects body: { groq_key, openai_key, gemini_key, openrouter_key } (fields can be omitted for partial updates)
 */
router.post('/vault/save', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { groq_key, openai_key, gemini_key, openrouter_key } = req.body;

  try {
    const updatedStatus = await saveUserKeys(userId, {
      groq_key,
      openai_key,
      gemini_key,
      openrouter_key
    });

    res.status(200).json({
      success: true,
      message: 'Credentials secured successfully.',
      vault_status: updatedStatus
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Save failed:', err.message);
    res.status(500).json({ error: 'Failed to secure credentials.' });
  }
});

/**
 * GET /api/vault/status
 * Exposes ONLY the masked status blueprints of credentials, never exposing raw keys.
 */
router.get('/vault/status', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const status = await getKeyStatus(userId);
    res.status(200).json({
      success: true,
      vault_status: status
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Status fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to retrieve vault configuration.' });
  }
});

module.exports = router;
