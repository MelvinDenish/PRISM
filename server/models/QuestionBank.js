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
    // Phase 3: company-aware provenance. `companyTag` ties a question to a real
    // company; `source` records where it came from (mentor uploads + internet
    // research are preferred over generic curated questions during sampling).
    companyTag: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    source: { type: String, enum: ['curated', 'mentor', 'research'], default: 'curated' },
    year: Number,                  // the year the question was reportedly asked
    provenanceUrl: String,         // research source URL (for 'research')
    researchedAt: Date,            // when the research pipeline produced it
    createdAt: { type: Date, default: Date.now }
});

questionBankSchema.index({ type: 1, difficulty: 1 });
// Phase 3: company-targeted sampling looks up by { companyTag, type }.
questionBankSchema.index({ companyTag: 1, type: 1 });

module.exports = mongoose.model('QuestionBank', questionBankSchema);
