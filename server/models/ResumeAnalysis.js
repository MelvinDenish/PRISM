const mongoose = require('mongoose');

const resumeAnalysisSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumeUrl: String,
    fileKey: String,        // storage key (for deletion); empty for pasted-text analyses
    storageDriver: String,  // 'local' | 's3' — which backend holds the file
    jobDescription: String,
    matchScore: Number,
    missingKeywords: [String],
    suggestions: String,
    redFlags: [String],
    starSuggestions: [String],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
