const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
    type: { type: String, enum: ['aptitude', 'technical1', 'coding', 'gd', 'technical2', 'hr'], required: true },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    answers: [{ questionId: String, selectedAnswer: String, isCorrect: Boolean, timeTaken: Number }],
    // Server-authoritative answer key for MCQ rounds: the exact questions served
    // (with correct answers) so submit-round can grade without trusting the client.
    // SECURITY: must never be sent to the client — always strip via sanitizeGame().
    servedQuestions: [{ questionId: String, ans: String, _id: false }],
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
    startedAt: { type: Date, default: Date.now },
    completedAt: Date
});

// Indexes (plan §3): history by user, leaderboard by completed status/score.
interviewGameSchema.index({ user: 1, startedAt: -1 });
interviewGameSchema.index({ status: 1, totalScore: -1 });

module.exports = mongoose.model('InterviewGame', interviewGameSchema);
