/**
 * Public file-access seam. Stored file URLs point here (/api/files/<key>).
 *
 * s3 driver  → bucket is PRIVATE; mint a short-lived presigned GET URL and
 *              302-redirect to it (bytes go browser↔S3, never through here).
 * local driver → redirect to the statically-served /uploads/<key>.
 *
 * Intentionally UNauthenticated so <img>/<iframe>/Office-viewer can load files
 * by URL (keys are random UUIDs, not enumerable). Sensitive artifacts are NOT
 * served here — they remain behind the authenticated /api/artifacts route.
 */
const express = require('express');
const storage = require('../utils/storage');

const router = express.Router();

// Keys look like "<folder>/<uuid>.<ext>" and are generated lowercase (lowercase
// folders + lowercase UUID + lowercased extension). The allowlist is therefore
// LOWERCASE-ONLY (no /i flag) so case-variant paths like "Artifacts/..." fail it
// outright — otherwise a case-insensitive allowlist + case-sensitive denylist
// would let the artifacts block be bypassed. The toLowerCase() on the denylist
// is belt-and-suspenders.
const KEY_RE = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{1,8}$/;

router.get('/*', async (req, res) => {
  const key = req.params[0] || '';
  if (!KEY_RE.test(key) || key.includes('..') || key.toLowerCase().startsWith('artifacts/')) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  try {
    if (storage.getSignedReadUrl) {
      const url = await storage.getSignedReadUrl(key);
      return res.redirect(302, url);
    }
    // local driver: file is served by express.static at /uploads
    const base = (process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
    return res.redirect(302, `${base}/uploads/${key}`);
  } catch {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
});

module.exports = router;
