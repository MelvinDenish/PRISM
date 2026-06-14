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
  // Set for LIVE multi-user GD rooms (routes/gdRooms.js evaluate); null for the
  // solo user-vs-AI GD. Lets each participant of one room get their own scorecard.
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'GDRoom', default: null, index: true },
  // Speaking stats for live rooms. Self-reported by each client from LiveKit
  // active-speaker data (same trust posture as the transcript). spokePct is this
  // user's share of total speaking time, 0-100.
  participation: {
    spokenSeconds: { type: Number, default: 0 },
    turns: { type: Number, default: 0 },
    spokePct: { type: Number, default: 0 },
  },
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
