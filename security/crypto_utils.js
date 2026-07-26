const crypto = require('crypto');
require('dotenv').config();

// Prefer a real server-side secret, but keep the app bootable if the env var is missing.
// In production, set ENCRYPTION_KEY in Render; the fallback is only a compatibility path.
const ENCRYPTION_SECRET = String(process.env.ENCRYPTION_KEY || '').trim() || 'ZAIRE::fallback-encryption-key::v1';
const USING_FALLBACK_SECRET = !String(process.env.ENCRYPTION_KEY || '').trim();

if (USING_FALLBACK_SECRET) {
  console.warn('[CRYPTO] ENCRYPTION_KEY is missing. Using a fallback secret so the backend can start, but you should set ENCRYPTION_KEY in production.');
}

// Derive a static 32-byte cryptographic key using SHA-256 hash of the secret.
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is standard for GCM

/**
 * Encrypts a raw plain text string using AES-256-GCM
 * @param {string} text - The raw secret/API Key
 * @returns {string} - The hex formatted iv + encrypted data block + auth tag (iv:encryptedBytes:authTag)
 */
function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Store iv and auth tag alongside ciphertext so we can decrypt later.
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (err) {
    console.error('[CRYPTO ERROR] Encryption failed:', err.message);
    throw new Error('Credential encryption failed.');
  }
}

/**
 * Decrypts a secure AES-256-GCM block
 * @param {string} encryptedBlock - The combined iv + encrypted text + auth tag (iv:encryptedBytes:authTag)
 * @returns {string} - The original raw plaintext string
 */
function decrypt(encryptedBlock) {
  if (!encryptedBlock) return null;
  try {
    const parts = encryptedBlock.split(':');
    
    // Fallback for older AES-256-CBC blocks (which only have 2 parts: iv and encryptedText)
    if (parts.length === 2) {
       console.warn('[CRYPTO] Legacy CBC encrypted block detected. It cannot be decrypted with GCM.');
       return null; 
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO ERROR] Decryption failed (key mismatch, corrupted payload, or legacy CBC format):', err.message);
    return null; // Return null instead of crashing server if keys are corrupted or rotated.
  }
}

/**
 * Helper to mask a raw key for secure status returns.
 * Works for any provider key format (Groq gsk_, OpenAI sk-, Anthropic sk-ant-, etc.)
 * Example: 'sk-ant-abc123...' -> 'sk-ant-********r3FY'
 * @param {string} key - The raw API key
 * @returns {string} - The masked string
 */
function maskKey(key) {
  if (!key) return null;
  if (key.length <= 12) return '********';
  return `${key.slice(0, 6)}********${key.slice(-4)}`;
}

module.exports = {
  encrypt,
  decrypt,
  maskKey
};

