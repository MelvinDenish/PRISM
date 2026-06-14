const mongoose = require('mongoose');

// P5: bounded per-user theme — accent + gradient override tokens only (never
// background/text, so it can't break contrast). Mirrors utils/themeGenerator.js.
const themeSchema = new mongoose.Schema({
    name: String,
    hue: Number,
    accentPrimary: String,
    accentPrimaryStrong: String,
    accentSecondary: String,
    accentAction: String,
    accentActionStrong: String,
    gradientPrimary: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['mentor', 'mentee', 'admin'],
        required: true
    },
    bio: String,
    skills: [String],
    expertise: [String],
    aimingCompany: String,
    currentCompany: String,
    experienceLevel: String,
    // C7: set once the mentee completes the diagnostic onboarding flow.
    onboarded: { type: Boolean, default: false },
    experience: { type: Number, default: 0 },
    college: String,
    graduationYear: Number,
    // ── Identity & academics (Phase 1: Profile + CUIC eligibility) ──
    // Self-editable via PUT /api/users/me. Used by the resume export filename
    // (RegisterNumber_Name.pdf) and the company eligibility checker.
    registerNumber: String,
    department: String,            // branch, e.g. 'CSE', 'IT', 'ECE'
    batch: String,                 // e.g. '2026' (free-form; graduationYear also exists)
    cgpa: Number,
    activeArrears: { type: Number, default: 0 },
    historyArrears: { type: Number, default: 0 },
    tenthPercent: Number,
    twelfthPercent: Number,
    linkedin: String,
    github: String,
    isOnline: { type: Boolean, default: false },
    profilePicture: String,
    avatarKey: String,      // storage key for an uploaded avatar (for deletion/replace)
    avatarDriver: String,   // 'local' | 's3' — which backend holds the avatar
    resumeUrl: String,
    // P5: per-user theme + Copilot greeting.
    theme: { type: themeSchema, default: undefined },
    greeting: String,
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },

    // ── Auth hardening (Phase 1, item 7) ──
    // Brute-force lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    // Token invalidation: JWTs issued before this moment are rejected (protect checks it)
    passwordChangedAt: Date,
    // Password reset (store a HASH of the token, never the raw token)
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    createdAt: { type: Date, default: Date.now }
});

// Indexes (plan §3) — email already unique above.
userSchema.index({ role: 1 });
userSchema.index({ resetPasswordToken: 1 });

// True while the account is temporarily locked after too many failed logins.
userSchema.methods.isLocked = function () {
    return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

module.exports = mongoose.model('User', userSchema);
