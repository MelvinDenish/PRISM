const mongoose = require('mongoose');

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
    linkedin: String,
    github: String,
    isOnline: { type: Boolean, default: false },
    profilePicture: String,
    avatarKey: String,      // storage key for an uploaded avatar (for deletion/replace)
    avatarDriver: String,   // 'local' | 's3' — which backend holds the avatar
    resumeUrl: String,
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
