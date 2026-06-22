/**
 * S3 storage driver — PRIVATE bucket. Objects are never public: keep S3 "Block
 * all public access" ON and add no bucket policy. Files are served through the
 * app's /api/files/<key> route (see routes/files.js), which mints a short-lived
 * presigned GET URL per request. saveFile therefore returns a STABLE app URL
 * (safe to persist in the DB) — never an expiring presigned link.
 * Works with S3-compatible endpoints (MinIO) via S3_ENDPOINT.
 */
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { config } = require('../../config/env');

const s3cfg = config.s3();
const SIGNED_URL_TTL = 900; // seconds (15 min) — presigned GET lifetime

const client = new S3Client({
  region: s3cfg.region,
  ...(s3cfg.endpoint ? { endpoint: s3cfg.endpoint, forcePathStyle: true } : {}),
  ...(s3cfg.accessKeyId && s3cfg.secretAccessKey
    ? { credentials: { accessKeyId: s3cfg.accessKeyId, secretAccessKey: s3cfg.secretAccessKey } }
    : {}),
});

function extFromName(name = '') {
  const m = String(name).match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function publicBase() {
  return (process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
}

// Stable, non-expiring URL persisted in the DB. Resolves to a fresh presigned
// link at access time via routes/files.js.
function fileRouteUrl(key) {
  return `${publicBase()}/api/files/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function saveFile({ buffer, mimeType, originalName, folder = 'resources' }) {
  const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, '');
  const key = `${safeFolder}/${crypto.randomUUID()}${extFromName(originalName)}`;
  await client.send(new PutObjectCommand({
    Bucket: s3cfg.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType || 'application/octet-stream',
    ContentDisposition: 'inline',
  }));
  return { key, url: fileRouteUrl(key) };
}

async function deleteFile(key) {
  if (!key) return;
  await client.send(new DeleteObjectCommand({ Bucket: s3cfg.bucket, Key: key }));
}

// Read bytes by key (server-side use, e.g. resource text extraction).
async function readFile(key) {
  if (!key) return null;
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: s3cfg.bucket, Key: key }));
    const chunks = [];
    for await (const chunk of out.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

// Short-lived presigned GET URL for browser/viewer access — the bucket stays private.
async function getSignedReadUrl(key) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: s3cfg.bucket, Key: key }), { expiresIn: SIGNED_URL_TTL });
}

module.exports = { saveFile, deleteFile, readFile, getSignedReadUrl };
