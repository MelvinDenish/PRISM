const mongoose = require('mongoose');

// One persisted solo-GD evaluation. The scores here are SERVER-computed (in
// POST /api/group-discussion/evaluate, via the strong eval model + rubric) — the
// in-game round reads its score from this document, never from a client number,
// which closes the aiScore hole. The transcript is client-supplied
// (self-reported), the same trust posture as InterviewAttempt.
const gdSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Set when the session is consumed by a game round; guards against replaying
  // one high-scoring session across many games.
  game: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewGame', default: null },
  consumed: { type: Boolean, default: false },
  topic: { type: String, default: '' },
  transcript: [{ speaker: String, message: String, _id: false }],
  scores: {
    overall: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    contentQuality: { type: Number, default: 0 },
    leadership: { type: Number, default: 0 },
    teamwork: { type: Number, default: 0 },
    reasoning: { type: Number, default: 0 },
  },
  feedback: {
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    detailedFeedback: { type: String, default: '' },
    verdict: { type: String, default: '' },
  },
  rubricVersion: { type: String, default: '' },
  gradedBy: { type: String, default: '' }, // model that produced the score (evalCompletion.modelUsed)
  createdAt: { type: Date, default: Date.now },
});
gdSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('GDSession', gdSessionSchema);
