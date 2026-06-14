/**
 * S3 storage driver (also works with S3-compatible endpoints like MinIO via
 * S3_ENDPOINT). Public URL comes from S3_PUBLIC_BASE_URL when set (CDN), else a
 * standard virtual-hosted bucket URL. The bucket must allow public read (bucket
 * policy or CloudFront) for in-app preview / Office viewer to work.
 */
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('../../config/env');

const s3cfg = config.s3();

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

function publicUrl(key) {
  if (s3cfg.publicBaseUrl) return `${s3cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  if (s3cfg.endpoint) return `${s3cfg.endpoint.replace(/\/$/, '')}/${s3cfg.bucket}/${key}`;
  return `https://${s3cfg.bucket}.s3.${s3cfg.region}.amazonaws.com/${key}`;
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
  return { key, url: publicUrl(key) };
}

async function deleteFile(key) {
  if (!key) return;
  await client.send(new DeleteObjectCommand({ Bucket: s3cfg.bucket, Key: key }));
}

module.exports = { saveFile, deleteFile };
