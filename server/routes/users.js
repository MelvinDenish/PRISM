const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');
const storage = require('../utils/storage');
const router = express.Router();

// Fields safe to expose about OTHER users. Excludes email and all auth/security
// fields so the user table's contact info can't be harvested by any logged-in user.
const PUBLIC_FIELDS =
    'name role bio skills expertise aimingCompany currentCompany experienceLevel ' +
    'experience college graduationYear linkedin github isOnline profilePicture ' +
    'rating totalReviews createdAt';
// Fields hidden even from the owner's own fetch (never need to leave the server).
const PRIVATE_SELECT = '-password -resetPasswordToken -resetPasswordExpire -failedLoginAttempts -lockUntil -passwordChangedAt';

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Avatars are served inline from our own origin, so SVG (which can embed
// <script>) is a stored-XSS vector. Restrict to raster image types only —
// deliberately excludes image/svg+xml even though the upload middleware allows it.
const AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select(PRIVATE_SELECT);
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// PUT /api/users/profile
// Accepts JSON fields and, optionally, an uploaded avatar image under field `file`.
// An uploaded image wins over a `profilePicture` URL in the same request.
router.put('/profile', protect, singleFile, async (req, res) => {
    try {
        const { name, bio, skills, aimingCompany, currentCompany, experienceLevel, profilePicture } = req.body;
        const update = { name, bio, skills, aimingCompany, currentCompany, experienceLevel };
        if (profilePicture !== undefined) update.profilePicture = profilePicture;

        // Avatar upload: raster images only, through the storage seam (local | s3).
        // SVG is rejected (stored-XSS risk when served inline from our origin).
        if (req.file) {
            if (!AVATAR_MIME.has(req.file.mimetype)) {
                return res.status(400).json({ success: false, message: 'Avatar must be a PNG, JPEG, GIF, or WebP image.' });
            }
            const saved = await storage.saveFile({
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                originalName: req.file.originalname,
                folder: 'avatars',
            });
            // Clean up the previous uploaded avatar (best-effort; ignore failures).
            const prev = await User.findById(req.user._id).select('avatarKey');
            if (prev?.avatarKey) {
                try { await storage.deleteFile(prev.avatarKey); } catch { /* orphan is harmless */ }
            }
            update.profilePicture = saved.url;
            update.avatarKey = saved.key;
            update.avatarDriver = storage.driver;
        }

        const user = await User.findByIdAndUpdate(req.user._id, update,
            { new: true, runValidators: true }
        ).select(PRIVATE_SELECT);
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// GET /api/users/mentors
router.get('/mentors', protect, async (req, res) => {
    try {
        const filter = { role: 'mentor' };
        if (req.query.company) filter.currentCompany = new RegExp(escapeRegex(req.query.company), 'i');
        if (req.query.skill) filter.skills = { $in: [new RegExp(escapeRegex(req.query.skill), 'i')] };
        const mentors = await User.find(filter).select(PUBLIC_FIELDS);
        res.json({ success: true, mentors });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
    try {
        // The owner (and admins) get the full record; everyone else a public subset.
        const isSelf = String(req.params.id) === String(req.user._id);
        const select = (isSelf || req.user.role === 'admin') ? PRIVATE_SELECT : PUBLIC_FIELDS;
        const user = await User.findById(req.params.id).select(select);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// GET /api/users (admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select(PRIVATE_SELECT);
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// DELETE /api/users/:id (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
