const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, bio, skills, aimingCompany, currentCompany, experienceLevel } = req.body;

        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Validate role
        if (!['mentor', 'mentee'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Role must be mentor or mentee' });
        }

        // Validate name length
        if (name.trim().length < 2 || name.trim().length > 50) {
            return res.status(400).json({ success: false, message: 'Name must be between 2 and 50 characters' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword, role,
            bio, skills, aimingCompany, currentCompany, experienceLevel
        });

        // Create progress tracker for mentees
        if (role === 'mentee') {
            await Progress.create({ mentee: user._id });
        }

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id, name: user.name, email: user.email, role: user.role,
                bio: user.bio, skills: user.skills, expertise: user.expertise,
                profilePicture: user.profilePicture, aimingCompany: user.aimingCompany,
                currentCompany: user.currentCompany, experienceLevel: user.experienceLevel,
                experience: user.experience, college: user.college, graduationYear: user.graduationYear,
                linkedin: user.linkedin, github: user.github, rating: user.rating,
                totalReviews: user.totalReviews, createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/auth/me — returns current user WITHOUT password hash
router.get('/me', protect, async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
});

module.exports = router;
