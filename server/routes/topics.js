const express = require('express');
const Topic = require('../models/Topic');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/topics
router.get('/', async (req, res) => {
    try {
        const topics = await Topic.find().populate('createdBy', 'name').sort({ name: 1 });
        res.json({ success: true, topics });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// POST /api/topics
router.post('/', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const topic = await Topic.create({ ...req.body, createdBy: req.user._id });
        res.status(201).json({ success: true, topic });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PUT /api/topics/:id
router.put('/:id', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, topic });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// DELETE /api/topics/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await Topic.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Topic deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
