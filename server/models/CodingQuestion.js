const mongoose = require('mongoose');

const codingQuestionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    category: String, // e.g. 'arrays', 'strings', 'dp' — for per-topic solved counts
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    companyTags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    // Legacy free-form sample (kept for backwards-compat with hand-added questions)
    sampleInput: String,
    sampleOutput: String,
    // Worked examples shown to the user (safe to expose)
    examples: [{ input: String, output: String, explanation: String }],
    // Hidden grading data — must NEVER be sent to the client (see routes/codingQuestions.js).
    // expectedOutput is produced by running `referenceSolution` (A7-safe), never hand-typed.
    testCases: [{ input: String, expectedOutput: String }],
    boilerplate: {
        javascript: String,
        python: String,
        cpp: String,
        java: String,
        c: String
    },
    // Python 3 reference solution used to (re)generate verified expected outputs.
    // Hidden from the client.
    referenceSolution: String,
    // True only once every test case was verified by the reference solution.
    // The submit endpoint refuses to grade an unverified problem.
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
