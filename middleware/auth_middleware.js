const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
require('dotenv').config();

// Clerk JWKS Client configuration (fetches Clerk's public signing keys dynamically)
// Clerk's standard JWKS endpoint is derived from the Frontend API URL or set globally
const CLERK_JWKS_URI = process.env.CLERK_JWKS_URI || `https://api.clerk.com/v1/jwks`;

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
 * Express middleware to enforce secure Clerk JWT authorization
 */
async function requireAuth(req, res, next) {
  // 1. Local Staging/Testing Shortcut (highly useful for CLI/cURL testing)
  const testUserId = req.headers['x-clerk-user-id'];
  if (testUserId && process.env.NODE_ENV !== 'production') {
    req.user = { id: testUserId, email: `${testUserId}@zaire.local` };
    return next();
  }

  // 2. Extract Bearer Token from Authorization Header
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
        email: decoded.email || decoded.user_email || null
      };

      next();
    });
  } catch (err) {
    console.error('[AUTH ERR] Cryptographic parse failed:', err.message);
    res.status(500).json({ error: 'Authentication routine failed' });
  }
}

module.exports = { requireAuth };
