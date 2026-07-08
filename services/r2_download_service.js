const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Uses Cloudflare R2 values from environment
const accountId = process.env.R2_ACCOUNT_ID || "demo_account_id";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "demo_access_key";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "demo_secret_key";
const bucketName = process.env.R2_BUCKET_NAME || "zaire-downloads";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function generateSignedDownloadUrl(platform) {
  let objectKey = 'ZAIRE_Setup.exe';
  if (platform === 'mac') objectKey = 'ZAIRE_Setup.dmg';
  if (platform === 'linux') objectKey = 'ZAIRE_Setup.AppImage';

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  // URL valid for 1 hour to prevent public sharing
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

module.exports = { generateSignedDownloadUrl };

