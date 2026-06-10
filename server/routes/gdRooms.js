const express = require('express');
const GDRoom = require('../models/GDRoom');
const { protect } = require('../middleware/auth');
const router = express.Router();

const GD_TOPICS = [
    'Should AI replace human jobs?',
    'Is remote work the future?',
    'Social media: boon or bane?',
    'Is a college degree still relevant?',
    'Technology vs. Privacy',
    'Climate change responsibility: individual or corporate?',
    'Should coding be mandatory in schools?',
    'Work-life balance in tech industry',
    'Is data the new oil?',
    'Startups vs. corporate careers'
];

// GET /api/gd-rooms
router.get('/', protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const rooms = await GDRoom.find(filter)
            .populate('participants', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, rooms });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// POST /api/gd-rooms - Create room
router.post('/', protect, async (req, res) => {
    try {
        const gdTopic = GD_TOPICS[Math.floor(Math.random() * GD_TOPICS.length)];
        const room = await GDRoom.create({
            ...req.body,
            gdTopic,
            participants: [req.user._id],
            host: req.user._id // creator; the sole publisher when mode === 'webinar'
        });
        res.status(201).json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/gd-rooms/:id/join
router.patch('/:id/join', protect, async (req, res) => {
    try {
        const room = await GDRoom.findById(req.params.id);
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        if (room.participants.length >= room.maxParticipants) {
            return res.status(400).json({ success: false, message: 'Room is full' });
        }

        if (!room.participants.includes(req.user._id)) {
            room.participants.push(req.user._id);

            // Auto-start when 4+ participants
            if (room.participants.length >= 4) {
                room.status = 'active';
            }
            await room.save();
        }

        const populated = await GDRoom.findById(room._id).populate('participants', 'name');
        res.json({ success: true, room: populated });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/gd-rooms/:id/status
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const room = await GDRoom.findByIdAndUpdate(
            req.params.id, { status: req.body.status }, { new: true }
        ).populate('participants', 'name');
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
