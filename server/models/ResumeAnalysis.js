const mongoose = require('mongoose');

const resumeAnalysisSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumeUrl: String,
    jobDescription: String,
    matchScore: Number,
    missingKeywords: [String],
    suggestions: String,
    redFlags: [String],
    starSuggestions: [String],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
