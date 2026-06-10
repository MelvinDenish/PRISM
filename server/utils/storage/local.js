/**
 * Local-disk storage driver. Files are written under server/uploads/<folder>/
 * and served by Express at /uploads (see server.js). Returns an absolute URL
 * built from SERVER_PUBLIC_URL so the client (and viewers) can reach the file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function extFromName(name = '') {
  const m = String(name).match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function publicBase() {
  return (process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
}

async function saveFile({ buffer, originalName, folder = 'resources' }) {
  const safeFolder = String(folder).replace(/[^a-z0-9/_-]/gi, '');
  const dir = path.join(UPLOAD_ROOT, safeFolder);
  await fs.promises.mkdir(dir, { recursive: true });

  const key = `${safeFolder}/${crypto.randomUUID()}${extFromName(originalName)}`;
  await fs.promises.writeFile(path.join(UPLOAD_ROOT, key), buffer);

  return { key, url: `${publicBase()}/uploads/${key}` };
}

async function deleteFile(key) {
  if (!key) return;
  const target = path.join(UPLOAD_ROOT, key);
  // Guard against path traversal — never delete outside UPLOAD_ROOT.
  if (!target.startsWith(UPLOAD_ROOT)) return;
  await fs.promises.rm(target, { force: true });
}

module.exports = { saveFile, deleteFile };
