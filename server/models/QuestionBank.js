const mongoose = require('mongoose');

const questionBankSchema = new mongoose.Schema({
    type: { type: String, enum: ['aptitude', 'technical', 'hr', 'coding'], required: true },
    category: String, // e.g. 'arithmetic', 'dsa', 'dbms', etc.
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    // For MCQ (aptitude/technical)
    q: String,
    opts: [String],
    ans: String,
    explanation: String,
    // For HR (open-ended)
    // q field is reused
    // For Coding
    title: String,
    description: String,
    examples: [{ input: String, output: String, explanation: String }],
    testCases: [{ input: String, expectedOutput: String }],
    boilerplate: {
        javascript: String,
        python: String,
        cpp: String,
        java: String,
        c: String
    },
    verified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

questionBankSchema.index({ type: 1, difficulty: 1 });

module.exports = mongoose.model('QuestionBank', questionBankSchema);
