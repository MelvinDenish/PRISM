const mongoose = require('mongoose');

const mockFeedbackSchema = new mongoose.Schema({
    mockInterview: { type: mongoose.Schema.Types.ObjectId, ref: 'MockInterview' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    communicationScore: Number,
    technicalScore: Number,
    confidenceScore: Number,
    problemSolvingScore: Number,
    overallScore: Number,
    strengths: String,
    weaknesses: String,
    suggestions: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MockFeedback', mockFeedbackSchema);
