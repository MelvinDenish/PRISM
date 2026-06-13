// Shared Review-Queue writes. The spaced-repetition queue (routes/review.js) and
// the targeted Interview Game (routes/interviewGame.js) both need to create
// review items, so the idempotent upsert lives here — one path, one schedule
// contract ($setOnInsert preserves an existing item's Leitner schedule).
const ReviewItem = require('../../models/ReviewItem');

/**
 * Idempotently insert review candidates. Each candidate must carry at least
 * { kind, sourceKey, prompt }; any extra snapshot fields (answer, explanation,
 * category, difficulty, company, refId) are stored on first insert only.
 * Returns how many were newly added (existing items keep their schedule).
 */
async function upsertReviewItems(userId, candidates) {
  const list = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && c.kind && c.sourceKey && c.prompt);
  if (!list.length) return 0;
  const now = new Date();
  const ops = list.map((c) => ({
    updateOne: {
      filter: { user: userId, kind: c.kind, sourceKey: String(c.sourceKey) },
      update: { $setOnInsert: { ...c, sourceKey: String(c.sourceKey), user: userId, box: 1, dueAt: now, mastered: false, timesReviewed: 0, createdAt: now, updatedAt: now } },
      upsert: true,
    },
  }));
  const result = await ReviewItem.bulkWrite(ops, { ordered: false });
  return result.upsertedCount || 0;
}

module.exports = { upsertReviewItems };
