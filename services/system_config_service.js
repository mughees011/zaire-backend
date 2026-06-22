const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { encrypt: aesEncrypt, decrypt: aesDecrypt } = require('../crypto_utils');

const CONFIG_FILE = path.join(__dirname, '..', 'memory', 'system_config.json');
const SECRETS_FILE = path.join(__dirname, '..', 'memory', 'api_secrets.json');

function readSystemConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('[CONFIG] Failed to read system config:', err.message);
    return {};
  }
}

function writeSystemConfig(nextConfig) {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
      fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(nextConfig, null, 2));
    return true;
  } catch (err) {
    console.error('[CONFIG] Failed to write system config:', err.message);
    return false;
  }
}

function sanitizeApiSlots(slots = []) {
  const validProviders = new Set([
    'Empty',
    'Groq',
    'OpenAI',
    'OpenRouter',
    'Anthropic',
    'Google Gemini',
    'DeepSeek',
    'Azure OpenAI',
    'Cohere',
    'Mistral',
    'SiliconFlow'
  ]);
  return (Array.isArray(slots) ? slots : [])
    .slice(0, 3)
    .map((slot, idx) => {
      const provider = validProviders.has(slot?.provider) ? slot.provider : 'Empty';
      return {
        slot: idx + 1,
        provider,
        apiKey: String(slot?.apiKey || '').trim(),
        hasKey: Boolean(slot?.hasKey),
        model: String(slot?.model || '').trim(),
        purpose: String(slot?.purpose || 'Fallback').trim() || 'Fallback',
        baseUrl: String(slot?.baseUrl || '').trim(),
        enabled: Boolean(slot?.enabled ?? (provider !== 'Empty'))
      };
    });
}

function loadSecrets() {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return { version: 2, slots: {} };
    const parsed = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.slots) {
      return parsed;
    }
    return { version: 2, slots: {} };
  } catch {
    return { version: 2, slots: {} };
  }
}

function saveSecrets(data) {
  try {
    if (!fs.existsSync(path.dirname(SECRETS_FILE))) {
      fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
    }
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function dpapiEncrypt(plain) {
  if (!plain) return '';
  const script = "$s=ConvertTo-SecureString -String $env:ZAIRE_SECRET -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s";
  return execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf-8',
    env: { ...process.env, ZAIRE_SECRET: plain }
  }).trim();
}

function dpapiDecrypt(cipher) {
  if (!cipher) return '';
  const script = "$s=ConvertTo-SecureString $env:ZAIRE_CIPHER; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); [Runtime.InteropServices.Marshal]::PtrToStringAuto($b)";
  return execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf-8',
    env: { ...process.env, ZAIRE_CIPHER: cipher }
  }).trim();
}

function encryptStoredSecret(plain) {
  if (!plain) return null;

  if (process.platform === 'win32') {
    try {
      return {
        scheme: 'dpapi',
        key: dpapiEncrypt(plain)
      };
    } catch (err) {
      console.warn('[SECRETS] DPAPI encryption unavailable, falling back to AES:', err.message);
    }
  }

  const encrypted = aesEncrypt(plain);
  if (!encrypted) {
    throw new Error('Fallback encryption failed.');
  }

  return {
    scheme: 'aes',
    key: encrypted
  };
}

function decryptStoredSecret(entry) {
  if (!entry) return '';

  if (typeof entry === 'string') {
    try {
      return process.platform === 'win32' ? dpapiDecrypt(entry) : (aesDecrypt(entry) || '');
    } catch {
      return aesDecrypt(entry) || '';
    }
  }

  if (!entry.key) return '';

  if (entry.scheme === 'aes') {
    return aesDecrypt(entry.key) || '';
  }

  try {
    return process.platform === 'win32' ? dpapiDecrypt(entry.key) : '';
  } catch {
    return '';
  }
}

function persistAiVaultSlots(slots = []) {
  const clean = sanitizeApiSlots(slots);
  const secrets = loadSecrets();
  const out = [];

  for (let i = 0; i < clean.length; i += 1) {
    const slot = clean[i];
    let secretStored = false;
    if (slot.apiKey) {
      try {
        const encryptedSecret = encryptStoredSecret(slot.apiKey);
        secrets.slots[String(i)] = {
          ...encryptedSecret,
          provider: slot.provider,
          updatedAt: new Date().toISOString()
        };
        secretStored = true;
      } catch (err) {
        console.error('[SECRETS] Encrypt failed:', err.message);
        delete secrets.slots[String(i)];
      }
    } else if (!slot.hasKey) {
      delete secrets.slots[String(i)];
    } else if (typeof secrets.slots[String(i)] === 'string' || secrets.slots[String(i)]?.key) {
      secretStored = true;
    }

    out.push({ ...slot, apiKey: '', hasKey: Boolean(secretStored) });
  }

  saveSecrets(secrets);
  return out;
}

function hydrateRuntimeProviders() {
  const cfg = readSystemConfig();
  const slots = sanitizeApiSlots(cfg?.aiVault?.slots || []);
  const secrets = loadSecrets();

  return slots.map((slot, i) => {
    const enc = secrets.slots?.[String(i)] || null;
    let key = '';
    if (enc) {
      try {
        key = decryptStoredSecret(enc);
      } catch (err) {
        console.error('[SECRETS] Decrypt failed:', err.message);
      }
    }
    return { ...slot, apiKey: key };
  });
}

function mergeAndSaveSystemConfig(config = {}) {
  const prev = readSystemConfig();
  const next = { ...prev, ...(config || {}) };

  if (config?.aiVault?.slots) {
    const persistedSlots = persistAiVaultSlots(config.aiVault.slots);
    next.aiVault = {
      ...(prev.aiVault || {}),
      ...(config.aiVault || {}),
      slots: persistedSlots,
      updatedAt: new Date().toISOString()
    };
  }

  const ok = writeSystemConfig(next);
  return { ok, next };
}

module.exports = {
  readSystemConfig,
  writeSystemConfig,
  sanitizeApiSlots,
  persistAiVaultSlots,
  hydrateRuntimeProviders,
  mergeAndSaveSystemConfig
};
