const express = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { saveUserKeys, getKeyStatus, getUserKeys } = require('../services/vault_service');
const {
  mergeAndSaveSystemConfig,
  persistTraderVault,
  hydrateTraderVault,
  readSystemConfig
} = require('../services/system_config_service');

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

const SUPPORTED_PROVIDERS = new Set([
  'groq',
  'openrouter',
  'openai',
  'google gemini',
  'anthropic',
  'deepseek',
  'mistral',
  'cohere',
  'azure openai',
  'siliconflow'
]);

function isSupportedProvider(provider = '') {
  return SUPPORTED_PROVIDERS.has(String(provider || '').trim().toLowerCase());
}

/**
 * Validates that a raw API key matches the expected format for its provider.
 * Returns { valid: boolean, reason?: string }
 */
function validateKeyFormat(provider = '', rawKey = '') {
  const p = String(provider || '').trim().toLowerCase();
  const k = String(rawKey || '').trim();
  if (!k) return { valid: false, reason: `No API key provided for ${provider}.` };

  const FORMAT_RULES = [
    { providers: ['groq'],                      prefix: 'gsk_',    label: 'Groq' },
    { providers: ['openai', 'azure openai'],    prefix: 'sk-',     label: 'OpenAI' },
    { providers: ['anthropic'],                 prefix: 'sk-ant-', label: 'Anthropic' },
  ];

  for (const rule of FORMAT_RULES) {
    if (rule.providers.includes(p)) {
      if (!k.startsWith(rule.prefix)) {
        return {
          valid: false,
          reason: `${rule.label} API keys must start with "${rule.prefix}". The key you entered doesn't match — double-check you copied the right key from ${rule.label}'s dashboard.`
        };
      }
      return { valid: true };
    }
  }

  // Providers without a fixed prefix (OpenRouter, Gemini, DeepSeek, Mistral, Cohere, SiliconFlow)
  // and custom providers. We'll enforce a small minimum length to catch empty/obvious errors, but allow short keys like 'ollama'.
  if (k.length < 3) {
    return { valid: false, reason: `The key for ${provider} looks too short. Please paste the full API key from your provider's dashboard.` };
  }
  return { valid: true };
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
    const decryptedSlots = await getUserKeys(userId);
    const syncResult = mergeAndSaveSystemConfig({
      aiVault: {
        slots: decryptedSlots.map((slot) => ({
          slot: Number(slot.slot),
          provider: slot.provider || 'Empty',
          apiKey: slot.key || '',
          hasKey: Boolean(slot.key),
          model: slot.model || '',
          purpose: slot.purpose || '',
          baseUrl: slot.baseUrl || '',
          enabled: Boolean(slot.enabled)
        }))
      }
    });
    if (!syncResult?.ok) {
      throw new Error('Failed to sync authenticated vault to local runtime.');
    }

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
    const decryptedSlots = await getUserKeys(userId);
    const syncResult = mergeAndSaveSystemConfig({
      aiVault: {
        slots: decryptedSlots.map((slot) => ({
          slot: Number(slot.slot),
          provider: slot.provider || 'Empty',
          apiKey: slot.key || '',
          hasKey: Boolean(slot.key),
          model: slot.model || '',
          purpose: slot.purpose || '',
          baseUrl: slot.baseUrl || '',
          enabled: Boolean(slot.enabled)
        }))
      }
    });
    if (!syncResult?.ok) {
      throw new Error('Failed to sync authenticated vault status to local runtime.');
    }

    res.status(200).json({
      success: true,
      vault_status: toStatusMap(status),
      slots: status,
      runtimeSynced: true
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
    const userId = req.user.id;
    const incomingSlot = Array.isArray(req.body?.slots) ? req.body.slots[0] : req.body;
    const slotNumber = Number(incomingSlot?.slot || 1);
    const provider = String(incomingSlot?.provider || '').trim();
    const rawKey = String(incomingSlot?.key || incomingSlot?.apiKey || '').trim();
    const enabled = Boolean(incomingSlot?.enabled ?? true);

    if (!enabled || !provider || provider === 'Empty') {
      return res.status(400).json({ success: false, error: 'Choose an active provider before testing.', code: 'VAULT_TEST_PROVIDER_REQUIRED' });
    }

    // We no longer strictly reject unknown providers here.
    // As long as there is a base URL configured, the backend will treat it as an OpenAI-compatible custom provider.
    // Validate key format if a raw key was provided
    if (rawKey) {
      const formatCheck = validateKeyFormat(provider, rawKey);
      if (!formatCheck.valid) {
        return res.status(400).json({ success: false, error: formatCheck.reason, code: 'VAULT_TEST_KEY_FORMAT_INVALID' });
      }
    }

    let resolvedKey = rawKey;
    if (!resolvedKey) {
      const storedKeys = await getUserKeys(userId);
      const storedSlot = storedKeys.find((entry) => Number(entry.slot) === slotNumber);
      resolvedKey = (
        storedSlot &&
        String(storedSlot.provider || '').toLowerCase() === provider.toLowerCase()
      ) ? String(storedSlot.key || '').trim() : '';
    }

    if (!resolvedKey) {
      return res.status(400).json({
        success: false,
        error: `No API key configured for ${provider} — add one in AI Vault under Settings.`,
        code: 'VAULT_TEST_KEY_REQUIRED'
      });
    }

    res.status(200).json({ success: true, message: `${provider} is configured and ready for runtime use.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to connect to provider.', code: 'VAULT_TEST_FAILED' });
  }
});


/**
 * POST /trading-vault
 * Save encrypted Binance + Alpaca API keys and paper/live toggle.
 * No auth token required — uses same local encryption as external APIs.
 */
router.post(['/trading-vault', '/api/vault/trading/save'], async (req, res) => {
  try {
    const {
      binanceApiKey = '',
      binanceSecretKey = '',
      alpacaApiKey = '',
      alpacaSecretKey = '',
      paperTrading = true,
      hasBinanceApi = false,
      hasBinanceSecret = false,
      hasAlpacaApi = false,
      hasAlpacaSecret = false
    } = req.body || {};

    const result = mergeAndSaveSystemConfig({
      traderVault: {
        binanceApiKey,
        binanceSecretKey,
        alpacaApiKey,
        alpacaSecretKey,
        paperTrading: Boolean(paperTrading),
        hasBinanceApi: Boolean(hasBinanceApi) || Boolean(binanceApiKey),
        hasBinanceSecret: Boolean(hasBinanceSecret) || Boolean(binanceSecretKey),
        hasAlpacaApi: Boolean(hasAlpacaApi) || Boolean(alpacaApiKey),
        hasAlpacaSecret: Boolean(hasAlpacaSecret) || Boolean(alpacaSecretKey)
      }
    });

    if (!result.ok) throw new Error('Failed to save trading vault.');

    const savedVault = result.next?.traderVault || {};
    console.log('[VAULT] Trading keys secured successfully.');

    res.status(200).json({
      success: true,
      message: 'Trading credentials secured.',
      traderVault: {
        hasBinanceApi: Boolean(savedVault.hasBinanceApi),
        hasBinanceSecret: Boolean(savedVault.hasBinanceSecret),
        hasAlpacaApi: Boolean(savedVault.hasAlpacaApi),
        hasAlpacaSecret: Boolean(savedVault.hasAlpacaSecret),
        binanceApiKeyMask: savedVault.binanceApiKeyMask || (savedVault.hasBinanceApi ? 'Saved Locally' : ''),
        binanceSecretKeyMask: savedVault.binanceSecretKeyMask || (savedVault.hasBinanceSecret ? 'Saved Locally' : ''),
        alpacaApiKeyMask: savedVault.alpacaApiKeyMask || (savedVault.hasAlpacaApi ? 'Saved Locally' : ''),
        alpacaSecretKeyMask: savedVault.alpacaSecretKeyMask || (savedVault.hasAlpacaSecret ? 'Saved Locally' : ''),
        paperTrading: Boolean(savedVault.paperTrading ?? true)
      }
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Trading vault save failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to secure trading credentials.', code: 'TRADER_VAULT_SAVE_FAILED' });
  }
});

/**
 * GET /trading-vault/status
 * Returns masked status of Binance + Alpaca keys.
 */
router.get(['/trading-vault/status', '/api/vault/trading/status'], async (req, res) => {
  try {
    const cfg = readSystemConfig();
    const tv = cfg?.traderVault || {};
    res.status(200).json({
      success: true,
      traderVault: {
        hasBinanceApi: Boolean(tv.hasBinanceApi),
        hasBinanceSecret: Boolean(tv.hasBinanceSecret),
        hasAlpacaApi: Boolean(tv.hasAlpacaApi),
        hasAlpacaSecret: Boolean(tv.hasAlpacaSecret),
        binanceApiKeyMask: tv.binanceApiKeyMask || (tv.hasBinanceApi ? 'Saved Locally' : ''),
        binanceSecretKeyMask: tv.binanceSecretKeyMask || (tv.hasBinanceSecret ? 'Saved Locally' : ''),
        alpacaApiKeyMask: tv.alpacaApiKeyMask || (tv.hasAlpacaApi ? 'Saved Locally' : ''),
        alpacaSecretKeyMask: tv.alpacaSecretKeyMask || (tv.hasAlpacaSecret ? 'Saved Locally' : ''),
        paperTrading: Boolean(tv.paperTrading ?? true)
      }
    });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Trading vault status failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to read trading vault status.', code: 'TRADER_VAULT_STATUS_FAILED' });
  }
});

/**
 * DELETE /trading-vault/clear
 * Clears a specific trading key or all trading keys.
 */
router.delete(['/trading-vault/clear', '/api/vault/trading/clear'], async (req, res) => {
  try {
    const { field } = req.body || {};
    const cfg = readSystemConfig();
    const tv = cfg?.traderVault || {};

    const clearMap = {
      binanceApiKey:    { hasBinanceApi: false,   binanceApiKeyMask: '' },
      binanceSecretKey: { hasBinanceSecret: false, binanceSecretKeyMask: '' },
      alpacaApiKey:     { hasAlpacaApi: false,     alpacaApiKeyMask: '' },
      alpacaSecretKey:  { hasAlpacaSecret: false,  alpacaSecretKeyMask: '' },
    };

    const patch = field && clearMap[field]
      ? { ...tv, [field]: '', ...clearMap[field] }
      : {
          binanceApiKey: '', hasBinanceApi: false, binanceApiKeyMask: '',
          binanceSecretKey: '', hasBinanceSecret: false, binanceSecretKeyMask: '',
          alpacaApiKey: '', hasAlpacaApi: false, alpacaApiKeyMask: '',
          alpacaSecretKey: '', hasAlpacaSecret: false, alpacaSecretKeyMask: '',
          paperTrading: Boolean(tv.paperTrading ?? true)
        };

    mergeAndSaveSystemConfig({ traderVault: patch });
    res.status(200).json({ success: true, message: field ? `${field} cleared.` : 'All trading keys cleared.' });
  } catch (err) {
    console.error('[VAULT ROUTE ERR] Trading vault clear failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to clear trading credentials.', code: 'TRADER_VAULT_CLEAR_FAILED' });
  }
});

module.exports = router;
