const mongoose = require('mongoose');

const codeSubmissionSchema = new mongoose.Schema({
    mockInterview: { type: mongoose.Schema.Types.ObjectId, ref: 'MockInterview' },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    code: String,
    language: String,
    output: String,
    error: String,
    score: Number,
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodeSubmission', codeSubmissionSchema);
