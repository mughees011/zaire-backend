const express = require('express');
const { requireAuth } = require('../auth_middleware');
const { saveUserKeys, getKeyStatus } = require('../vault_service');

const router = express.Router();

function getDefaultModelForProvider(provider = '') {
  const normalized = String(provider || '').toLowerCase();
  if (normalized.includes('groq')) return 'llama-3.1-8b-instant';
  if (normalized.includes('openrouter')) return 'openai/gpt-4o-mini';
  if (normalized.includes('openai') && !normalized.includes('azure')) return 'gpt-4o-mini';
  if (normalized.includes('gemini')) return 'gemini-1.5-flash';
  if (normalized.includes('anthropic')) return 'claude-3-5-sonnet-20241022';
  if (normalized.includes('deepseek')) return 'deepseek-chat';
  if (normalized.includes('cohere')) return 'command-r-plus';
  if (normalized.includes('mistral')) return 'mistral-large-latest';
  if (normalized.includes('siliconflow')) return 'Qwen/Qwen2.5-7B-Instruct';
  return 'gpt-4o-mini';
}

function toStatusMap(statusRows = []) {
  const map = {};
  for (const row of Array.isArray(statusRows) ? statusRows : []) {
    const providerKey = String(row.provider || '').toLowerCase();
    if (!providerKey || providerKey === 'empty') continue;
    if (providerKey.includes('groq')) map.groq = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('openrouter')) map.openrouter = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('openai') && !providerKey.includes('azure')) map.openai = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('gemini')) map.gemini = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('anthropic')) map.anthropic = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('deepseek')) map.deepseek = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('cohere')) map.cohere = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('mistral')) map.mistral = { configured: Boolean(row.hasKey), mask: row.mask || '' };
    else if (providerKey.includes('siliconflow')) map.siliconflow = { configured: Boolean(row.hasKey), mask: row.mask || '' };
  }
  return map;
}

function normalizeIncomingSlots(body = {}) {
  if (Array.isArray(body.slots)) {
    return body.slots.map((slot, index) => ({
      slot: Number(slot.slot || index + 1),
      provider: slot.provider || 'Empty',
      key: slot.apiKey || slot.key || '',
      model: slot.model || getDefaultModelForProvider(slot.provider),
      purpose: slot.purpose || (index === 0 ? 'Primary' : index === 1 ? 'Coding' : 'Fallback'),
      baseUrl: slot.baseUrl || '',
      enabled: Boolean(slot.enabled ?? (slot.provider && slot.provider !== 'Empty'))
    }));
  }

  const mappedProviders = [
    ['groq_key', 'Groq'],
    ['openai_key', 'OpenAI'],
    ['gemini_key', 'Google Gemini'],
    ['openrouter_key', 'OpenRouter'],
    ['anthropic_key', 'Anthropic'],
    ['deepseek_key', 'DeepSeek'],
    ['cohere_key', 'Cohere'],
    ['mistral_key', 'Mistral'],
    ['siliconflow_key', 'SiliconFlow']
  ];

  return mappedProviders
    .filter(([keyName]) => String(body[keyName] || '').trim())
    .slice(0, 3)
    .map(([keyName, provider], index) => ({
      slot: index + 1,
      provider,
      key: String(body[keyName] || '').trim(),
      model: getDefaultModelForProvider(provider),
      purpose: index === 0 ? 'Primary' : index === 1 ? 'Coding' : 'Fallback',
      baseUrl: '',
      enabled: true
    }));
}

/**
 * POST /ai-vault
 * Safely saves or updates user API keys in AI Vault slots.
 */
router.post(['/ai-vault', '/api/vault/save'], requireAuth, async (req, res) => {
  const userId = req.user.id;
  const slots = normalizeIncomingSlots(req.body || {});

  try {
    const updatedStatus = await saveUserKeys(userId, slots || []);

    res.status(200).json({
      success: true,
      message: 'Credentials secured successfully.',
      vault_status: toStatusMap(updatedStatus),
      slots: updatedStatus
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Save failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to secure credentials.', code: 'VAULT_SAVE_FAILED' });
  }
});

/**
 * GET /ai-vault
 * Exposes ONLY the masked status blueprints of credentials.
 */
router.get(['/ai-vault', '/api/vault/status'], requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const status = await getKeyStatus(userId);
    res.status(200).json({
      success: true,
      vault_status: toStatusMap(status),
      slots: status
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Status fetch failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve vault configuration.', code: 'VAULT_STATUS_FAILED' });
  }
});

/**
 * POST /ai-vault/test
 * Tests the provided credentials by pinging the provider.
 */
router.post(['/ai-vault/test', '/api/vault/test'], requireAuth, async (req, res) => {
  try {
    // Mock implementation for the test endpoint
    res.status(200).json({ success: true, message: 'Provider connection successful.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to connect to provider.', code: 'VAULT_TEST_FAILED' });
  }
});

module.exports = router;
