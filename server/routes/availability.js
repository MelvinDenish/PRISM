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
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
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
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/availability/book/:slotIndex
router.patch('/book/:slotIndex', protect, async (req, res) => {
    try {
        const { mentorId } = req.body;
        const slotIdx = parseInt(req.params.slotIndex, 10);
        if (!Number.isInteger(slotIdx) || slotIdx < 0) {
            return res.status(400).json({ success: false, message: 'Invalid slot index' });
        }

        const slotField = `availableSlots.${slotIdx}.isBooked`;
        // Atomic claim: only succeeds if the slot exists and is not already booked.
        // Prevents the check-then-write race that allowed double-booking.
        const availability = await Availability.findOneAndUpdate(
            { mentor: mentorId, [slotField]: false },
            { $set: { [slotField]: true } },
            { new: true }
        );

        if (!availability) {
            // Either no such availability/slot, or it was already booked.
            const exists = await Availability.findOne({ mentor: mentorId });
            if (!exists || slotIdx >= exists.availableSlots.length) {
                return res.status(404).json({ success: false, message: 'No availability found for that slot' });
            }
            return res.status(409).json({ success: false, message: 'This slot is already booked' });
        }

        res.json({ success: true, availability });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
