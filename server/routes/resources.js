const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const Resource = require('../models/Resource');
const { protect, authorize, isOwner } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');
const storage = require('../utils/storage');
const router = express.Router();

// Block obvious SSRF targets (loopback / private ranges) before fetching a URL.
function isUnsafeHost(hostname = '') {
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0' || h === '::1') return true;
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true; // link-local / cloud metadata
    return false;
}

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

// GET /api/resources/reader?url=  — fetch an external article and return
// readable, sanitized HTML so it can be previewed IN-APP (no redirect).
// Auth-gated + SSRF-guarded to avoid being an open proxy.
router.get('/reader', protect, async (req, res) => {
    try {
        const raw = String(req.query.url || '');
        let parsed;
        try { parsed = new URL(raw); } catch { return res.status(400).json({ success: false, message: 'Invalid URL' }); }
        if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ success: false, message: 'Only http/https URLs are allowed' });
        if (isUnsafeHost(parsed.hostname)) return res.status(400).json({ success: false, message: 'This URL is not allowed' });

        const resp = await axios.get(raw, {
            timeout: 8000,
            maxRedirects: 3,
            maxContentLength: 5 * 1024 * 1024,
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM-Reader/1.0)' },
        });

        const dom = new JSDOM(resp.data, { url: raw });
        const article = new Readability(dom.window.document).parse();
        if (!article || !article.content) {
            return res.status(422).json({ success: false, message: 'Could not extract a readable view of this page.' });
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
