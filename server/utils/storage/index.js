/**
 * Storage adapter — single seam for file persistence.
 *
 * Routes call this module, never a cloud SDK directly. The concrete driver is
 * chosen by STORAGE_DRIVER (local | s3). Switching to a college server later is
 * one env change (STORAGE_DRIVER=local) with no code edits.
 *
 *   const storage = require('../utils/storage');
 *   const { key, url } = await storage.saveFile({ buffer, mimeType, originalName, folder });
 *   await storage.deleteFile(key);
 */
const { config } = require('../../config/env');

const driver = config.storageDriver();
// Only the selected driver is required, so the S3 SDK is never loaded under the
// local default (keeps `npm install` light on the college server).
const impl = driver === 's3' ? require('./s3') : require('./local');

module.exports = {
  driver,
  saveFile: impl.saveFile,
  deleteFile: impl.deleteFile,
  // Optional read seam (local driver only for now; undefined under s3 — callers
  // that need bytes there fall back to fetching the file's public URL).
  readFile: impl.readFile,
};
