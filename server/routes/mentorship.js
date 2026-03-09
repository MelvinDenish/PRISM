const express = require('express');
const MentorshipSession = require('../models/MentorshipSession');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// POST /api/mentorship - Book a session
router.post('/', protect, authorize('mentee'), async (req, res) => {
    try {
        const { mentor, scheduledDate, duration, agenda, aimingCompany } = req.body;
        const session = await MentorshipSession.create({
            mentor, mentee: req.user._id, scheduledDate, duration, agenda, aimingCompany
        });

        // Notify mentor
        await Notification.create({
            user: mentor, type: 'session',
            message: `New mentorship session request from ${req.user.name}`
        });

        res.status(201).json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/mentorship - Get user's sessions
router.get('/', protect, async (req, res) => {
    try {
        const filter = req.user.role === 'mentor'
            ? { mentor: req.user._id }
            : { mentee: req.user._id };

        if (req.query.status) filter.status = req.query.status;

        const sessions = await MentorshipSession.find(filter)
            .populate('mentor', 'name email currentCompany profilePicture')
            .populate('mentee', 'name email aimingCompany profilePicture')
            .populate('aimingCompany', 'name')
            .sort({ scheduledDate: -1 });

        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/mentorship/:id/status - Approve/Reject/Complete
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status, mentorFeedback, menteeFeedback } = req.body;
        const session = await MentorshipSession.findById(req.params.id);

        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        session.status = status;
        if (mentorFeedback) session.mentorFeedback = mentorFeedback;
        if (menteeFeedback) session.menteeFeedback = menteeFeedback;
        await session.save();

        // Notify the other party
        const notifyUser = req.user.role === 'mentor' ? session.mentee : session.mentor;
        await Notification.create({
            user: notifyUser, type: 'session',
            message: `Mentorship session ${status} by ${req.user.name}`
        });

        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/mentorship/:id/rate - Rate a session
router.patch('/:id/rate', protect, async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const session = await MentorshipSession.findById(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        session.ratingGiven = rating;
        if (req.user.role === 'mentee') {
            session.menteeFeedback = feedback;
            // Update mentor's average rating
            const mentor = await User.findById(session.mentor);
            const newTotal = mentor.totalReviews + 1;
            mentor.rating = ((mentor.rating * mentor.totalReviews) + rating) / newTotal;
            mentor.totalReviews = newTotal;
            await mentor.save();
        } else {
            session.mentorFeedback = feedback;
        }
        await session.save();

        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
