const express = require('express');
const MentorshipSession = require('../models/MentorshipSession');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { bookSession } = require('../agent/services/mentorship');
const router = express.Router();

// POST /api/mentorship - Book a session. Validation + notify + email live in the
// shared service so the assistant's booking confirm-flow behaves identically.
// Email stays fire-and-forget here to keep this response fast (awaitEmail=false).
router.post('/', protect, authorize('mentee'), async (req, res) => {
    try {
        const { mentor, scheduledDate, duration, agenda, aimingCompany } = req.body;
        const { session } = await bookSession({
            menteeId: req.user._id,
            menteeName: req.user.name,
            mentorId: mentor,
            scheduledDate,
            duration,
            agenda,
            aimingCompany,
        });
        res.status(201).json({ success: true, session });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message),
        });
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
            .populate('mentor', 'name email currentCompany profilePicture isOnline')
            .populate('mentee', 'name email aimingCompany profilePicture')
            .sort({ scheduledDate: -1 })
            .limit(50);

        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/mentorship/:id/status - Approve/Reject/Complete
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status, mentorFeedback, menteeFeedback } = req.body;

        // Validate status transition
        const validStatuses = ['approved', 'rejected', 'completed', 'cancelled', 'in-progress'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const session = await MentorshipSession.findById(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        // Authorization: only mentor can approve/reject; either party can complete/cancel
        const isMentor = req.user._id.toString() === session.mentor.toString();
        const isMentee = req.user._id.toString() === session.mentee.toString();
        if (!isMentor && !isMentee) {
            return res.status(403).json({ success: false, message: 'Not authorized for this session' });
        }
        if (['approved', 'rejected'].includes(status) && !isMentor) {
            return res.status(403).json({ success: false, message: 'Only the mentor can approve or reject sessions' });
        }

        session.status = status;
        if (mentorFeedback) session.mentorFeedback = mentorFeedback;
        if (menteeFeedback) session.menteeFeedback = menteeFeedback;
        if (status === 'completed') session.completedAt = new Date();
        await session.save();

        // Notify the other party
        const notifyUser = req.user.role === 'mentor' ? session.mentee : session.mentor;
        await Notification.create({
            user: notifyUser, type: 'session',
            message: `Mentorship session ${status} by ${req.user.name}`
        });

        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/mentorship/:id/rate - Rate a session
router.patch('/:id/rate', protect, async (req, res) => {
    try {
        const { rating, feedback } = req.body;

        // Validate rating range
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        const session = await MentorshipSession.findById(req.params.id);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        // Authorization: only a participant of THIS session may rate it.
        const isMentor = session.mentor.equals(req.user._id);
        const isMentee = session.mentee.equals(req.user._id);
        if (!isMentor && !isMentee) {
            return res.status(403).json({ success: false, message: 'Not authorized for this session' });
        }

        // Only completed sessions can be rated
        if (session.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Can only rate completed sessions' });
        }

        // Each party may rate once — tracked per role so the mentee's rating
        // doesn't block the mentor's feedback (and vice-versa).
        if (isMentee) {
            if (session.menteeRated) {
                return res.status(400).json({ success: false, message: 'You have already rated this session' });
            }
            session.menteeRated = true;
            session.ratingGiven = rating;
            session.menteeFeedback = feedback;
            // Update mentor's average rating from the mentee's score.
            const mentor = await User.findById(session.mentor);
            if (mentor) {
                const newTotal = mentor.totalReviews + 1;
                mentor.rating = ((mentor.rating * mentor.totalReviews) + rating) / newTotal;
                mentor.totalReviews = newTotal;
                await mentor.save();
            }
        } else {
            if (session.mentorRated) {
                return res.status(400).json({ success: false, message: 'You have already rated this session' });
            }
            session.mentorRated = true;
            session.mentorFeedback = feedback;
        }
        await session.save();

        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
