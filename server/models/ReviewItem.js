const mongoose = require('mongoose');

// C3: spaced-repetition review queue. One row = one thing the mentee got wrong /
// is weak at and should revisit (a missed MCQ, an unsolved coding problem, or a
// lagging topic). Scheduling is a 5-box Leitner system (deliberately simpler than
// SM-2 — the plan asks for a "scheduled review queue", not ease-factor SR).
//
// IMPORTANT (anti-dangling-ref): the human-readable content is SNAPSHOTTED here at
// populate time (`prompt`/`answer`/`explanation`). Source ids (QuestionBank /
// CodingQuestion / Topic _ids) change whenever the DB is reseeded, so the live
// `refId` is kept ONLY for the "re-attempt this" deep-link and may dangle — the
// queue never depends on resolving it.

// Leitner intervals in days, indexed by box (1..5). A correct review advances the
// box and pushes `dueAt` out by that box's interval; box 5 + correct → mastered.
const LEITNER_DAYS = [1, 3, 7, 16, 35];
const MAX_BOX = 5;

const reviewItemSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['mcq', 'coding', 'topic'], required: true },
    // Stable dedup key within (user, kind): questionId (mcq) / CodingQuestion _id
    // (coding) / Topic _id (topic), all as strings.
    sourceKey: { type: String, required: true },
    // Live ref for the re-attempt action only (coding → CodingQuestion, topic → Topic).
    refId: { type: mongoose.Schema.Types.ObjectId },

    // Reseed-proof snapshot of what to show:
    prompt: { type: String, required: true }, // question text / problem title / topic name
    answer: String,                            // correct answer (mcq)
    explanation: String,                       // mcq explanation / weakness note
    category: String,
    difficulty: String,
    // P8: when a wrong answer comes from a company-targeted Interview Game, tag the
    // company name so the Review Queue can show "what you missed prepping for X".
    company: String,

    // Leitner scheduling
    box: { type: Number, default: 1, min: 1, max: MAX_BOX },
    dueAt: { type: Date, default: Date.now },
    lastReviewedAt: Date,
    timesReviewed: { type: Number, default: 0 },
    mastered: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// One active item per (user, kind, source). Dedup on populate.
reviewItemSchema.index({ user: 1, kind: 1, sourceKey: 1 }, { unique: true });
// Queue read: due, not-mastered items for a user, oldest-due first.
reviewItemSchema.index({ user: 1, mastered: 1, dueAt: 1 });

// Apply a Leitner grade. `remembered` advances the box (or masters at the top);
// forgetting resets to box 1 and resurfaces the item shortly.
reviewItemSchema.methods.applyReview = function (remembered) {
    const now = new Date();
    this.lastReviewedAt = now;
    this.timesReviewed += 1;
    if (remembered) {
        if (this.box >= MAX_BOX) {
            this.mastered = true;
        } else {
            this.box += 1;
        }
        const days = LEITNER_DAYS[Math.min(this.box, MAX_BOX) - 1];
        this.dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    } else {
        this.box = 1;
        // Resurface in the same session (~10 min) rather than immediately, so it
        // doesn't loop, but stays "due today".
        this.dueAt = new Date(now.getTime() + 10 * 60 * 1000);
    }
    this.updatedAt = now;
    return this;
};

module.exports = mongoose.model('ReviewItem', reviewItemSchema);
module.exports.LEITNER_DAYS = LEITNER_DAYS;
module.exports.MAX_BOX = MAX_BOX;
