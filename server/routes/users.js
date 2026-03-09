const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, bio, skills, aimingCompany, currentCompany, experienceLevel, profilePicture } = req.body;
        const user = await User.findByIdAndUpdate(req.user._id,
            { name, bio, skills, aimingCompany, currentCompany, experienceLevel, profilePicture },
            { new: true, runValidators: true }
        ).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/users/mentors
router.get('/mentors', protect, async (req, res) => {
    try {
        const filter = { role: 'mentor' };
        if (req.query.company) filter.currentCompany = new RegExp(req.query.company, 'i');
        if (req.query.skill) filter.skills = { $in: [new RegExp(req.query.skill, 'i')] };
        const mentors = await User.find(filter).select('-password');
        res.json({ success: true, mentors });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/users (admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/users/:id (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
