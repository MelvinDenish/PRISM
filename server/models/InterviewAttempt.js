const mongoose = require('mongoose');

/**
 * A standalone (solo) AI interview attempt (plan Phase 1, B2).
 *
 * SELF-REPORTED: the score is computed from a client-supplied transcript, so the
 * server has no proof the conversation actually happened the way it was sent.
 * That is fine for the user's OWN progress tracking (they only fool themselves)
 * but means these scores must NEVER feed a comparative or mentor-visible surface
 * (e.g. the leaderboard) — keep them in their own dashboard section.
 *
 * The Interview Game persists its own rounds (incl. HR/technical2/GD), so those
 * are deliberately NOT recorded here to avoid double-counting.
 */
const interviewAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['technical', 'hr'], default: 'technical' },
  topic: { type: String, default: '' },
  overallScore: { type: Number, default: 0 },
  // Per-dimension scores as returned by the evaluator (technicalSkill,
  // communication, problemSolving, confidence, …) — shape varies by interview type.
  dimensions: { type: Map, of: Number, default: {} },
  strengths: [String],
  improvements: [String],
  detailedFeedback: { type: String, default: '' },
  recommendation: { type: String, default: '' },
  questionsAnswered: { type: Number, default: 0 },
  rubricVersion: { type: String, default: '' }, // which rubric graded this (for trend comparability)
  model: { type: String, default: '' },         // which LLM actually graded it
  createdAt: { type: Date, default: Date.now },
});

// History/trend by user, newest first.
interviewAttemptSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('InterviewAttempt', interviewAttemptSchema);
