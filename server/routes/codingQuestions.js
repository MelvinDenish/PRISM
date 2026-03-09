const express = require('express');
const CodingQuestion = require('../models/CodingQuestion');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/coding-questions
router.get('/', protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.difficulty) filter.difficulty = req.query.difficulty;
        if (req.query.topic) filter.topic = req.query.topic;
        if (req.query.company) filter.companyTags = req.query.company;

        const questions = await CodingQuestion.find(filter)
            .populate('topic', 'name')
            .populate('companyTags', 'name')
            .sort({ createdAt: -1 });

        res.json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/coding-questions/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const question = await CodingQuestion.findById(req.params.id)
            .populate('topic', 'name')
            .populate('companyTags', 'name');
        if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
        res.json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/coding-questions
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const question = await CodingQuestion.create(req.body);
        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/coding-questions/:id
router.put('/:id', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const question = await CodingQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/coding-questions/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await CodingQuestion.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
