const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { config } = require('../config/env');
const { sendPasswordResetEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { emit: emitSignals, ensureProfile } = require('../agent/services/signals');
const SkillSignal = require('../models/SkillSignal');

const router = express.Router();

// Brute-force lockout policy
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Password reset token lifetime
const RESET_TOKEN_MINUTES = 30;

// Strong password: >= 8 chars, at least one letter and one number.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'password must be at least 8 characters and include a letter and a number';

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

// Hash a reset token before storing it (so a DB leak can't be used to reset accounts).
const hashResetToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Shared validation schemas
const registerSchema = {
    name: { required: true, trim: true, minLength: 2, maxLength: 50 },
    email: { required: true, email: true, trim: true, maxLength: 254 },
    password: { required: true, minLength: 8, maxLength: 128, pattern: PASSWORD_PATTERN, patternMessage: PASSWORD_MESSAGE },
    role: { required: true, enum: ['mentor', 'mentee'] },
};
const loginSchema = {
    email: { required: true, email: true, trim: true },
    password: { required: true },
};
const forgotPasswordSchema = {
    email: { required: true, email: true, trim: true },
};
const resetPasswordSchema = {
    token: { required: true },
    password: { required: true, minLength: 8, maxLength: 128, pattern: PASSWORD_PATTERN, patternMessage: PASSWORD_MESSAGE },
};

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
    const { name, email, password, role, bio, skills, aimingCompany, currentCompany, experienceLevel } = req.body;
    // Field-level validation is handled by validate(registerSchema) above.

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        throw new AppError('Email already registered', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name: name.trim(), email: normalizedEmail, password: hashedPassword, role,
        bio, skills, aimingCompany, currentCompany, experienceLevel,
        passwordChangedAt: new Date(),
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
}));

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        // Per-account lockout (complements the per-IP authLimiter).
        if (user.isLocked()) {
            throw new AppError('Account temporarily locked due to too many failed attempts. Try again later.', 423);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
                user.failedLoginAttempts = 0; // reset counter; lockUntil now gates access
                logger.warn('account_locked', { userId: String(user._id) });
            }
            await user.save();
            throw new AppError('Invalid credentials', 401);
        }

        // Successful login — clear any failure state.
        if (user.failedLoginAttempts || user.lockUntil) {
            user.failedLoginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id, name: user.name, email: user.email, role: user.role,
                onboarded: user.onboarded,
                bio: user.bio, skills: user.skills, expertise: user.expertise,
                profilePicture: user.profilePicture, aimingCompany: user.aimingCompany,
                currentCompany: user.currentCompany, experienceLevel: user.experienceLevel,
                experience: user.experience, college: user.college, graduationYear: user.graduationYear,
                linkedin: user.linkedin, github: user.github, rating: user.rating,
                totalReviews: user.totalReviews, createdAt: user.createdAt
            }
        });
}));

// GET /api/auth/me — returns current user WITHOUT password hash
router.get('/me', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
}));

// PUT /api/auth/onboarding — persist the mentee diagnostic and flip `onboarded`.
// The generated prep plan is created separately by the client via
// /learning-paths/generate, so this stays a thin profile write.
router.put('/onboarding', protect, asyncHandler(async (req, res) => {
    const { aimingCompany, experienceLevel, skills } = req.body;
    const update = { onboarded: true };
    if (typeof aimingCompany === 'string') update.aimingCompany = aimingCompany.trim();
    if (['beginner', 'intermediate', 'advanced'].includes(experienceLevel)) update.experienceLevel = experienceLevel;
    if (Array.isArray(skills)) update.skills = skills.filter((s) => typeof s === 'string').slice(0, 20);
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('-password');
    // P6 spine: seed the prep profile from the diagnostic. Self-reported level
    // baselines the four skill pillars (NOT resume — that needs a real ATS run).
    // Weight is the standard 'diagnostic' 1.5 and decays away within weeks, so
    // real activity quickly dominates the self-report.
    // Best-effort like emitSignals: spine seeding must never 500 the onboarding
    // gate — `onboarded: true` is already committed above, so a throw here would
    // strand the user half-onboarded.
    try {
        const LEVEL_SCORE = { beginner: 0.35, intermediate: 0.55, advanced: 0.7 };
        const base = LEVEL_SCORE[experienceLevel];
        // Idempotent: re-running the diagnostic must not stack another 4 signals.
        if (base !== undefined && !(await SkillSignal.exists({ user: req.user._id, source: 'diagnostic' }))) {
            await emitSignals(req.user._id, ['aptitude', 'dsa', 'cs_core', 'communication'].map((pillar) => ({
                pillar, skill: 'diagnostic', score: base, source: 'diagnostic', sourceId: user._id,
            })));
        }
        if (update.aimingCompany) {
            const profile = await ensureProfile(req.user._id);
            if (!profile.targetCompanies.some((c) => c.name === update.aimingCompany)) {
                profile.targetCompanies.unshift({ name: update.aimingCompany, priority: 1 });
                profile.targetCompanies = profile.targetCompanies.slice(0, 5);
                await profile.save();
            }
        }
    } catch (err) {
        logger.warn('onboarding_prep_seed_failed', { userId: String(req.user._id), err: err.message });
    }
    res.json({ success: true, user });
}));

// POST /api/auth/forgot-password — issue a reset token (emailed). Always 200 so
// the response can't be used to enumerate which emails are registered.
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = hashResetToken(rawToken);
        user.resetPasswordExpire = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
        await user.save();

        const resetUrl = `${config.clientOrigins()[0]}/reset-password?token=${rawToken}`;
        if (config.hasEmail()) {
            await sendPasswordResetEmail(user.email, user.name, resetUrl);
        } else {
            // Email not configured (dev): log the link so the flow is still testable.
            logger.warn('password_reset_link_unsent_email_disabled', { userId: String(user._id), resetUrl });
        }
    }

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
}));

// POST /api/auth/reset-password — consume a valid token and set a new password.
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(async (req, res) => {
    const tokenHash = hashResetToken(req.body.token);
    const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpire: { $gt: new Date() },
    });
    if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    // Invalidate all existing JWTs issued before this reset.
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'Password has been reset. Please log in.' });
}));

module.exports = router;
