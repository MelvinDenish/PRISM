const express = require('express');
const Availability = require('../models/Availability');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/availability/:mentorId
router.get('/:mentorId', protect, async (req, res) => {
    try {
        const availability = await Availability.findOne({ mentor: req.params.mentorId });
        res.json({ success: true, availability: availability || { availableSlots: [] } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/availability - Set availability slots
router.post('/', protect, authorize('mentor'), async (req, res) => {
    try {
        let availability = await Availability.findOne({ mentor: req.user._id });
        if (availability) {
            availability.availableSlots = req.body.availableSlots;
            await availability.save();
        } else {
            availability = await Availability.create({ mentor: req.user._id, availableSlots: req.body.availableSlots });
        }
        res.json({ success: true, availability });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/availability/book/:slotIndex
router.patch('/book/:slotIndex', protect, async (req, res) => {
    try {
        const { mentorId } = req.body;
        const availability = await Availability.findOne({ mentor: mentorId });
        if (!availability) return res.status(404).json({ success: false, message: 'No availability found' });

        const slotIdx = parseInt(req.params.slotIndex);
        if (slotIdx < 0 || slotIdx >= availability.availableSlots.length) {
            return res.status(400).json({ success: false, message: 'Invalid slot index' });
        }

        if (availability.availableSlots[slotIdx].isBooked) {
            return res.status(409).json({ success: false, message: 'This slot is already booked' });
        }

        availability.availableSlots[slotIdx].isBooked = true;
        await availability.save();

        res.json({ success: true, availability });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
