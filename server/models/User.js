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
    aimingCompany: String,
    currentCompany: String,
    experienceLevel: String,
    profilePicture: String,
    resumeUrl: String,
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
