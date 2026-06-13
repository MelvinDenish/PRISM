const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
    type: { type: String, enum: ['aptitude', 'technical1', 'coding', 'gd', 'technical2', 'hr'], required: true },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    answers: [{ questionId: String, selectedAnswer: String, isCorrect: Boolean, timeTaken: Number }],
    // Server-authoritative answer key for MCQ rounds: the exact questions served
    // (with correct answers) so submit-round can grade without trusting the client.
    // P8 also snapshots the prompt/explanation/category/difficulty and the source
    // QuestionBank `bankId` so a wrong answer can be turned into a fully-snapshotted,
    // correctly-deduped ReviewItem (sourceKey = bankId, NOT the positional questionId).
    // AI-generated fallback MCQs have no bankId → no ReviewItem (honest limitation).
    // SECURITY: must never be sent to the client — always strip via sanitizeGame().
    servedQuestions: [{ questionId: String, ans: String, bankId: String, q: String, explanation: String, category: String, difficulty: String, _id: false }],
    // Server-authoritative coding test cases (with expected outputs) for the
    // coding round, so submit-round can run the user's code and grade it without
    // trusting the client. SECURITY: stripped by sanitizeGame(), never sent out.
    // `problems` holds the test cases for EVERY problem served in the round so the
    // round score reflects all of them (the UI grades two problems). `testCases`
    // is the legacy single-problem shape, kept so in-flight games still grade.
    servedCoding: {
        problems: [{ problemId: String, testCases: [{ input: String, expectedOutput: String, _id: false }], _id: false }],
        testCases: [{ input: String, expectedOutput: String, _id: false }],
        _id: false,
    },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'skipped'], default: 'pending' },
    feedback: String,
    completedAt: Date
});

const interviewGameSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rounds: [roundSchema],
    currentRound: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    maxTotalScore: { type: Number, default: 600 },
    status: { type: String, enum: ['in-progress', 'completed', 'abandoned'], default: 'in-progress' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    companyFocus: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    // P8: snapshot of the targeting context so /questions can pick a template and
    // the report can show what the game was tuned for.
    companyName: { type: String, default: '' },
    targetRole: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date
});

// Indexes (plan §3): history by user, leaderboard by completed status/score.
interviewGameSchema.index({ user: 1, startedAt: -1 });
interviewGameSchema.index({ status: 1, totalScore: -1 });

module.exports = mongoose.model('InterviewGame', interviewGameSchema);
