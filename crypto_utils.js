const crypto = require('crypto');
require('dotenv').config();

// Require a real server-side encryption key for vault data.
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_SECRET) {
  throw new Error(
    'Missing ENCRYPTION_KEY in backend environment. Set a strong secret before starting ZAIRE.'
  );
}

// Derive a static 32-byte cryptographic key using SHA-256 hash of the secret
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 bytes for AES block sizes

/**
 * Encrypts a raw plain text string using AES-256-CBC
 * @param {string} text - The raw secret/API Key
 * @returns {string} - The hex formatted iv + encrypted data block (iv:encryptedBytes)
 */
function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Store iv alongside ciphertext so we can decrypt later
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[CRYPTO ERROR] Encryption failed:', err.message);
    throw new Error('Credential encryption failed.');
  }
}

/**
 * Decrypts a secure AES-256-CBC block
 * @param {string} encryptedBlock - The combined iv + encrypted text (iv:encryptedBytes)
 * @returns {string} - The original raw plaintext string
 */
function decrypt(encryptedBlock) {
  if (!encryptedBlock) return null;
  try {
    const parts = encryptedBlock.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO ERROR] Decryption failed (Key mismatch or corrupted payload):', err.message);
    return null; // Return null instead of crashing server if keys are corrupted or rotated
  }
}

/**
 * Helper to mask a raw key for secure status returns
 * Example: 'gsk_YzmxIOZsIF...' -> 'gsk_Yz...r3FY'
 * @param {string} key - The raw API key
 * @returns {string} - The masked string
 */
function maskKey(key) {
  if (!key) return null;
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

module.exports = {
  encrypt,
  decrypt,
  maskKey
};

