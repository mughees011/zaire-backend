const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../db');

// R2 Config from Environment Variables
const r2Config = {
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
};

const s3Client = new S3Client(r2Config);
const BUCKET_NAME = process.env.R2_BUCKET || 'zaire-releases';

/**
 * POST /downloads/signed-url
 * Returns a pre-signed Cloudflare R2 URL for the requested release file.
 */
router.post('/signed-url', requireAuth, async (req, res) => {
  const { fileKey, platform, version, licenseId } = req.body;
  const userId = req.user.id;

    if (!fileKey) {
    return res.status(400).json({ success: false, error: 'Missing fileKey parameter.', code: 'DOWNLOAD_MISSING_FILEKEY' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey
    });

    // URL expires in 15 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // Track the download in the database
    await pool.query(
      `
      INSERT INTO downloads
      (user_id, license_id, platform, version, file_key, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [userId, licenseId || null, platform || 'unknown', version || 'latest', fileKey, req.ip]
    );

    res.json({ success: true, url: signedUrl });
  } catch (error) {
    console.error('[DOWNLOADS ERR] Failed to generate signed URL:', error.message);
    res.status(500).json({ success: false, error: 'Failed to generate secure download link.', code: 'DOWNLOAD_URL_FAILED' });
  }
});

/**
 * GET /downloads/releases
 * Returns the list of latest available versions (Mocked for MVP, eventually fetching from R2 or DB)
 */
router.get('/releases', async (req, res) => {
  try {
    // For MVP, we return a static latest release manifest.
    // Future iteration can fetch objects from R2 using ListObjectsV2Command.
    res.json({
      success: true,
      releases: {
        windows: {
          available: true,
          version: '1.0.0-beta',
          fileKey: 'releases/windows/ZAIRE_Installer_1.0.0-beta.exe',
          notes: 'Initial Engineer Mode Release'
        },
        mac_silicon: {
          available: false,
          version: null,
          fileKey: null,
          notes: 'Apple Silicon package not published yet.'
        },
        mac_intel: {
          available: false,
          version: null,
          fileKey: null,
          notes: 'Intel macOS package not published yet.'
        },
        linux: {
          available: false,
          version: null,
          fileKey: null,
          notes: 'Linux package not published yet.'
        }
      }
    });
  } catch (error) {
    console.error('[DOWNLOADS ERR] Failed to fetch releases:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch releases.', code: 'DOWNLOAD_RELEASES_FAILED' });
  }
});

module.exports = router;
