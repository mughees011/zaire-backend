const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const crypto = require('crypto');
require('dotenv').config();

// Clerk JWKS Client configuration (fetches Clerk's public signing keys dynamically)
// Clerk's standard JWKS endpoint is derived from the Frontend API URL or set globally
const CLERK_JWKS_URI = process.env.CLERK_JWKS_URI || `https://trusting-gnat-21.clerk.accounts.dev/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri: CLERK_JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMin: 10
});

// Helper to retrieve the correct signing key for the JWT signature
function getKey(header, callback) {
  client.getSigningKey(header.kid, function(err, key) {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Derive a stable, consistent user ID from a license key.
 * This ensures all chat sessions saved under a license key share the same user ID.
 */
function licenseToUserId(licenseKey) {
  return 'local_' + crypto.createHash('sha256').update(licenseKey).digest('hex').slice(0, 16);
}

/**
 * Express middleware to enforce secure Clerk JWT authorization
 * 
 * Priority order:
 *  1. x-clerk-user-id header shortcut (dev/staging only)
 *  2. x-zaire-license header  — local/desktop app auth (no JWT needed)
 *  3. Clerk JWT Bearer token   — web app with signed-in user
 */
async function requireAuth(req, res, next) {
  // 1. Local Staging/Testing Shortcut (highly useful for CLI/cURL testing)
  const testUserId = req.headers['x-clerk-user-id'];
  if (testUserId && process.env.NODE_ENV !== 'production') {
    req.user = { id: testUserId, email: `${testUserId}@zaire.local` };
    return next();
  }

  // 2. License-key auth — used by the desktop app and local web frontend.
  //    The frontend always sends x-zaire-license in fetchJsonOrThrow.
  //    We derive a stable user ID from the license so chats are correctly scoped.
  const licenseKey = req.headers['x-zaire-license'] || req.headers['x-zaire-license-key'];
  if (licenseKey) {
    req.user = {
      id: licenseToUserId(licenseKey),
      email: 'local@zaire.desktop',
      authMethod: 'license'
    };
    return next();
  }

  // 3. Extract Bearer Token from Authorization Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 3. Cryptographically verify the Clerk JWT session token
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) {
        console.warn('[AUTH] JWT verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Session signature is invalid or expired' });
      }

      // 4. Attach decoded Clerk user meta to request
      req.user = {
        id: decoded.sub, // 'sub' claim holds Clerk's User ID
        email: decoded.email || decoded.user_email || null,
        authMethod: 'clerk'
      };

      next();
    });
  } catch (err) {
    console.error('[AUTH ERR] Cryptographic parse failed:', err.message);
    res.status(500).json({ error: 'Authentication routine failed' });
  }
}

module.exports = { requireAuth };
