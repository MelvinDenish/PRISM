const mongoose = require('mongoose');

// C4: a persistent behavioral/STAR answer bank. Candidates draft, save, and
// refine their own stories ("tell me about a conflict") and reuse them — the
// HR/GD flows generate-and-discard, this keeps the user's own content.
const behavioralAnswerSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    // STAR framework fields
    situation: String,
    task: String,
    action: String,
    result: String,
    tags: [String], // e.g. 'leadership', 'conflict', 'failure'
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

behavioralAnswerSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('BehavioralAnswer', behavioralAnswerSchema);
