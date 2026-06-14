const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const Resource = require('../models/Resource');
const { protect, authorize, isOwner } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');
const storage = require('../utils/storage');
const { assertSafeUrl } = require('../utils/urlGuard');
const router = express.Router();

// Strip scripts/embeds/event handlers from extracted article HTML before it is
// rendered in-app (defensive; Readability already removes most active content).
function sanitizeHtml(html) {
    return String(html)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<(?:iframe|object|embed|form|link|meta)\b[^>]*>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '');
}

// Map an uploaded file's MIME type to our resourceType enum for preview routing.
function typeFromMime(mime = '') {
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'ppt';
    if (mime.includes('word') || mime === 'application/msword') return 'doc';
    return 'file';
}

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/resources
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.topic) filter.topic = req.query.topic;
        if (req.query.level) filter.level = req.query.level;
        if (req.query.type) filter.resourceType = req.query.type;
        if (req.query.company) filter.companyTag = req.query.company;
        if (req.query.search) filter.title = new RegExp(escapeRegex(req.query.search), 'i');

        const resources = await Resource.find(filter)
            .populate('topic', 'name')
            .populate('uploadedBy', 'name')
            .populate('companyTag', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, resources });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// Fraction of an extracted article's visible text that lives inside links.
// Changelogs / roadmaps / link directories are link-dominated; real articles
// are mostly prose.
function readerLinkDensity(html) {
    try {
        const doc = new JSDOM(String(html)).window.document;
        const total = (doc.body.textContent || '').replace(/\s+/g, ' ').trim().length;
        if (!total) return 1;
        let linkLen = 0;
        doc.querySelectorAll('a').forEach((a) => { linkLen += (a.textContent || '').trim().length; });
        return linkLen / total;
    } catch { return 0; }
}

// Decide whether a Readability parse is actually an article worth reading
// in-app. Homepages, roadmaps and changelogs DO extract as "content"
// (cp-algorithms.com/ extracts its news list, which is what users were seeing),
// but they are not articles — for those we 422 so the client falls back to its
// "open original" view instead of rendering a confusing dump.
function isReadableArticle(pageUrl, article) {
    // 1. A bare site root (https://site/, /index.html) is a homepage.
    let path = '/';
    try { path = new URL(pageUrl).pathname; } catch { /* keep default */ }
    const trimmedPath = path.replace(/\/+$/, '');
    if (trimmedPath === '' || /^\/index\.html?$/i.test(trimmedPath)) return false;

    // 2. Too little prose to be a real article (JS-app landing pages, near-empty).
    const textLen = (article.textContent || '').trim().length;
    if (textLen < 600) return false;

    // 3. Link-dominated content (changelogs, roadmaps, link indexes).
    if (readerLinkDensity(article.content) > 0.5) return false;

    return true;
}

// GET /api/resources/reader?url=  — fetch an external article and return
// readable, sanitized HTML so it can be previewed IN-APP (no redirect).
// Auth-gated + SSRF-guarded to avoid being an open proxy.
router.get('/reader', protect, async (req, res) => {
    try {
        const raw = String(req.query.url || '');

        // SSRF guard: re-validate (DNS-resolving) the URL at EVERY hop and follow
        // redirects manually with maxRedirects:0, so a public URL can't 30x-redirect
        // to cloud metadata / loopback / RFC-1918, and DNS can't be re-pointed
        // between check and fetch. Single canonical guard: utils/urlGuard.
        let currentUrl = raw;
        let resp;
        for (let hop = 0; hop < 4; hop++) {
            const check = await assertSafeUrl(currentUrl);
            if (!check.ok) return res.status(400).json({ success: false, message: check.reason });

            resp = await axios.get(currentUrl, {
                timeout: 8000,
                maxRedirects: 0,
                validateStatus: (s) => (s >= 200 && s < 400),
                maxContentLength: 5 * 1024 * 1024,
                responseType: 'text',
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM-Reader/1.0)' },
            });

            if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
                currentUrl = new URL(resp.headers.location, currentUrl).toString();
                continue; // loop re-validates the new target before fetching it
            }
            break; // 2xx — got the page
        }
        if (resp.status >= 300) return res.status(502).json({ success: false, message: 'Too many redirects.' });

        const parsed = new URL(currentUrl);
        const dom = new JSDOM(resp.data, { url: currentUrl });
        const article = new Readability(dom.window.document).parse();
        if (!article || !article.content) {
            return res.status(422).json({ success: false, message: 'Could not extract a readable view of this page.' });
        }
        if (!isReadableArticle(currentUrl, article)) {
            return res.status(422).json({ success: false, message: 'This looks like a homepage or link index, not an article. Open the original to read it.' });
        }
        res.json({
            success: true,
            title: article.title || '',
            byline: article.byline || '',
            siteName: article.siteName || parsed.hostname,
            content: sanitizeHtml(article.content),
        });
    } catch (e) {
        res.status(502).json({ success: false, message: 'Could not load this page for in-app reading. Open the original instead.' });
    }
});

// GET /api/resources/:id
router.get('/:id', async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('topic', 'name')
            .populate('uploadedBy', 'name')
            .populate('companyTag', 'name');
        if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
        res.json({ success: true, resource });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// POST /api/resources — accepts JSON (link-based) OR multipart with a `file`
// field (mentor upload). `singleFile` is a no-op for JSON requests.
router.post('/', protect, authorize('admin', 'mentor'), singleFile, async (req, res) => {
    try {
        const { title, description, topic, level, resourceType, link, companyTag } = req.body;
        const doc = {
            title, description, topic, level, link, companyTag,
            resourceType,
            uploadedBy: req.user._id,
        };

        if (req.file) {
            const saved = await storage.saveFile({
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                originalName: req.file.originalname,
                folder: 'resources',
            });
            doc.fileUrl = saved.url;
            doc.fileKey = saved.key;
            doc.fileName = req.file.originalname;
            doc.fileSize = req.file.size;
            doc.mimeType = req.file.mimetype;
            doc.storageDriver = storage.driver;
            doc.link = saved.url;                       // keep `link` populated for older readers
            doc.resourceType = resourceType || typeFromMime(req.file.mimetype);
        }

        if (!doc.topic) return res.status(400).json({ success: false, message: 'Topic is required' });
        if (!req.file && !doc.link) return res.status(400).json({ success: false, message: 'Provide a link or upload a file' });

        const resource = await Resource.create(doc);
        res.status(201).json({ success: true, resource });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PUT /api/resources/:id — only the uploader (or an admin) may edit
router.put('/:id', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const existing = await Resource.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Resource not found' });
        if (!isOwner(existing, req, 'uploadedBy')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        // Don't allow reassigning the uploader.
        const { uploadedBy, ...updates } = req.body;
        const resource = await Resource.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json({ success: true, resource });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// DELETE /api/resources/:id — only the uploader (or an admin) may delete
router.delete('/:id', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const existing = await Resource.findById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Resource not found' });
        if (!isOwner(existing, req, 'uploadedBy')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        // Best-effort: remove the stored file too (only if this server's driver owns it).
        if (existing.fileKey && (!existing.storageDriver || existing.storageDriver === storage.driver)) {
            try { await storage.deleteFile(existing.fileKey); } catch (e) { /* non-fatal */ }
        }
        await existing.deleteOne();
        res.json({ success: true, message: 'Resource deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
// Exposed for verification scripts (seeds/verifyReaderGuard.js).
module.exports._isReadableArticle = isReadableArticle;
module.exports._readerLinkDensity = readerLinkDensity;
