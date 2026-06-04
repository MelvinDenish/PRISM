const express = require('express');
const MockInterview = require('../models/MockInterview');
const Notification = require('../models/Notification');
const { protect, authorize, isOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/mock-interviews
router.get('/', protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.type) filter.type = req.query.type;
        if (req.query.status) filter.status = req.query.status;

        const interviews = await MockInterview.find(filter)
            .populate('mentor', 'name')
            .populate('participants', 'name')
            .populate('companyFocus', 'name')
            .populate('topic', 'name')
            .sort({ scheduledDate: -1 });

        res.json({ success: true, interviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/mock-interviews
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const interview = await MockInterview.create({ ...req.body, mentor: req.user._id });
        res.status(201).json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/mock-interviews/:id/join
router.patch('/:id/join', protect, async (req, res) => {
    try {
        const interview = await MockInterview.findById(req.params.id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

        if (!interview.participants.includes(req.user._id)) {
            interview.participants.push(req.user._id);
            await interview.save();
        }

        res.json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/mock-interviews/:id/status
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const interview = await MockInterview.findById(req.params.id);
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
        // Only the hosting mentor (or an admin) may change an interview's status.
        if (!isOwner(interview, req, 'mentor')) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        interview.status = req.body.status;
        await interview.save();
        res.json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/mock-interviews/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const interview = await MockInterview.findById(req.params.id)
            .populate('mentor', 'name email')
            .populate('participants', 'name email')
            .populate('companyFocus', 'name')
            .populate('topic', 'name');
        if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
        res.json({ success: true, interview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
