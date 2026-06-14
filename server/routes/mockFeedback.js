const express = require('express');
const MockFeedback = require('../models/MockFeedback');
const Progress = require('../models/Progress');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// POST /api/mock-feedback — only mentors/admins give feedback
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const feedback = await MockFeedback.create(req.body);

        // Update user's progress mock interview stats
        const userFeedbacks = await MockFeedback.find({ user: req.body.user });
        const avgScores = userFeedbacks.reduce((acc, f) => {
            acc.technical += f.technicalScore || 0;
            acc.hr += f.communicationScore || 0;
            acc.gd += f.confidenceScore || 0;
            acc.count++;
            return acc;
        }, { technical: 0, hr: 0, gd: 0, count: 0 });

        if (avgScores.count > 0) {
            await Progress.findOneAndUpdate(
                { mentee: req.body.user },
                {
                    'mockInterviewStats.technicalScoreAvg': Math.round(avgScores.technical / avgScores.count),
                    'mockInterviewStats.hrScoreAvg': Math.round(avgScores.hr / avgScores.count),
                    'mockInterviewStats.gdScoreAvg': Math.round(avgScores.gd / avgScores.count)
                }
            );
        }

        res.status(201).json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/mock-feedback/interview/:interviewId
router.get('/interview/:interviewId', protect, async (req, res) => {
    try {
        const feedbacks = await MockFeedback.find({ mockInterview: req.params.interviewId })
            .populate('user', 'name');
        res.json({ success: true, feedbacks });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/mock-feedback/user/:userId — a user may only read their own feedback
router.get('/user/:userId', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.params.userId !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        const feedbacks = await MockFeedback.find({ user: req.params.userId })
            .populate('mockInterview', 'type companyFocus')
            .sort({ createdAt: -1 });
        res.json({ success: true, feedbacks });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
