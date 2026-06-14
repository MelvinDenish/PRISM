const express = require('express');
const { protect } = require('../middleware/auth');
const BehavioralAnswer = require('../models/BehavioralAnswer');
const router = express.Router();

const fail = (res, err) => res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });

// GET /api/behavioral — list the caller's saved STAR answers
router.get('/', protect, async (req, res) => {
    try {
        const answers = await BehavioralAnswer.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.json({ success: true, answers });
    } catch (err) { fail(res, err); }
});

// POST /api/behavioral — create
router.post('/', protect, async (req, res) => {
    try {
        const { question, situation, task, action, result, tags } = req.body;
        if (!question || !question.trim()) return res.status(400).json({ success: false, message: 'Question is required' });
        const answer = await BehavioralAnswer.create({
            user: req.user._id,
            question: question.trim(),
            situation, task, action, result,
            tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 10) : [],
        });
        res.status(201).json({ success: true, answer });
    } catch (err) { fail(res, err); }
});

// PUT /api/behavioral/:id — update (user-scoped)
router.put('/:id', protect, async (req, res) => {
    try {
        const { question, situation, task, action, result, tags } = req.body;
        const update = { situation, task, action, result, updatedAt: new Date() };
        if (typeof question === 'string' && question.trim()) update.question = question.trim();
        if (Array.isArray(tags)) update.tags = tags.filter((t) => typeof t === 'string').slice(0, 10);
        const answer = await BehavioralAnswer.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id }, update, { new: true });
        if (!answer) return res.status(404).json({ success: false, message: 'Answer not found' });
        res.json({ success: true, answer });
    } catch (err) { fail(res, err); }
});

// DELETE /api/behavioral/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        const deleted = await BehavioralAnswer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!deleted) return res.status(404).json({ success: false, message: 'Answer not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { fail(res, err); }
});

module.exports = router;
