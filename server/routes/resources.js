const express = require('express');
const Resource = require('../models/Resource');
const { protect, authorize, isOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/resources
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.topic) filter.topic = req.query.topic;
        if (req.query.level) filter.level = req.query.level;
        if (req.query.type) filter.resourceType = req.query.type;
        if (req.query.company) filter.companyTag = req.query.company;
        if (req.query.search) filter.title = new RegExp(req.query.search, 'i');

        const resources = await Resource.find(filter)
            .populate('topic', 'name')
            .populate('uploadedBy', 'name')
            .populate('companyTag', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, resources });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/resources
router.post('/', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const resource = await Resource.create({ ...req.body, uploadedBy: req.user._id });
        res.status(201).json({ success: true, resource });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
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
        await existing.deleteOne();
        res.json({ success: true, message: 'Resource deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
