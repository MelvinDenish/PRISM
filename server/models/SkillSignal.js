const mongoose = require('mongoose');

// The five readiness pillars. Fixed taxonomy — every scored activity in the app
// maps onto exactly one of these (spec: prepare-architecture overhaul, P6).
const PILLARS = ['aptitude', 'dsa', 'cs_core', 'communication', 'resume'];

const SOURCES = [
    'interview_game', 'coding', 'ai_interview', 'gd_solo', 'gd_live',
    'review', 'resume_analysis', 'diagnostic', 'mentor_feedback',
];

// Append-only event log: one row = one piece of scored evidence about a skill.
// Readiness is always recomputed FROM these rows (never mutated in place), so
// scoring-logic changes can rescore history for free.
const skillSignalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pillar: { type: String, enum: PILLARS, required: true },
    skill: { type: String, default: '' },          // free tag: 'arrays', 'dbms', 'hr'
    score: { type: Number, min: 0, max: 1, required: true },
    weight: { type: Number, default: 1 },          // source trust, see SOURCE_WEIGHTS
    source: { type: String, enum: SOURCES, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    at: { type: Date, default: Date.now },
});

// Readiness reads: all of one user's signals for a pillar, newest first.
skillSignalSchema.index({ user: 1, pillar: 1, at: -1 });

module.exports = mongoose.model('SkillSignal', skillSignalSchema);
module.exports.PILLARS = PILLARS;
module.exports.SOURCES = SOURCES;
