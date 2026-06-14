const mongoose = require('mongoose');

const codeSubmissionSchema = new mongoose.Schema({
    mockInterview: { type: mongoose.Schema.Types.ObjectId, ref: 'MockInterview' },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    code: String,
    language: String,
    output: String,
    error: String,
    // Grading outcome (server-authoritative — see POST /coding-questions/:id/submit)
    passed: { type: Boolean, default: false }, // all test cases passed
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    status: { type: String, enum: ['accepted', 'wrong_answer', 'runtime_error', 'error'], default: 'error' },
    score: Number, // 0–100
    submittedAt: { type: Date, default: Date.now }
});

// Solved-state / streak / history are DERIVED from these (no denormalized counters).
codeSubmissionSchema.index({ user: 1, submittedAt: -1 });
codeSubmissionSchema.index({ user: 1, question: 1, passed: 1 });

module.exports = mongoose.model('CodeSubmission', codeSubmissionSchema);
