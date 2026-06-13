// Throwaway P8 verification: templates, category-weighted sampling, and the
// wrong-answer → company-tagged ReviewItem path (with the correctness-critical
// sourceKey = QuestionBank _id dedup). Runs against local Mongo; cleans up after.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyTargetedGame.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ReviewItem = require('../models/ReviewItem');
const { resolveTemplate, difficultyFromReadiness } = require('../utils/gameTemplates');
const { upsertReviewItems } = require('../agent/services/reviewQueue');
const { sampleWeighted } = require('../routes/interviewGame');

const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ role: 'mentee' });
  if (!user) throw new Error('no mentee user found — run seedAll first');

  // ── 1. Templates ────────────────────────────────────────────────────────
  const g = resolveTemplate({ companyName: 'Google', role: 'SDE' });
  assert(g.roleFamily === 'sde' && g.difficulty === 'hard', 'Google → sde / hard');
  assert(g.rounds.technical1.categoryWeights.dsa >= 3, 'SDE tech1 biases dsa');
  assert(Object.keys(g.rounds).length === 6, 'template keeps all 6 round types');
  const t = resolveTemplate({ companyName: 'TCS' });
  assert(t.roleFamily === 'core' && t.difficulty === 'easy', 'TCS → core / easy');
  const d = resolveTemplate({ role: 'Data Analyst' });
  assert(d.roleFamily === 'data', 'role "Data Analyst" → data family (no company)');
  const ovr = resolveTemplate({ companyName: 'Google', difficulty: 'easy' });
  assert(ovr.difficulty === 'easy', 'explicit difficulty overrides the company bias');
  assert(difficultyFromReadiness(30) === 'easy' && difficultyFromReadiness(80) === 'hard' && difficultyFromReadiness(0) === 'medium',
    'readiness → difficulty mapping (30→easy, 80→hard, 0→medium)');

  // ── 2. Category-weighted sampling (real function, real bank) ─────────────
  const cfg = g.rounds.technical1; // dsa:3, algorithms:3, oop:1, difficulty hard
  const docs = await sampleWeighted('technical', cfg, 10);
  assert(docs.length === 10, `sampleWeighted returns the requested size (got ${docs.length})`);
  assert(new Set(docs.map((x) => String(x._id))).size === docs.length, 'sampled questions are unique (no dupes)');
  const weighted = docs.filter((x) => ['dsa', 'algorithms', 'oop'].includes(x.category)).length;
  assert(weighted >= 6, `majority of the round is from weighted categories (${weighted}/10 dsa/algorithms/oop)`);

  // ── 3. Wrong answers → company-tagged review items, deduped by bankId ─────
  await ReviewItem.deleteMany({ user: user._id, explanation: 'P8-VERIFY' });
  const bankA = new mongoose.Types.ObjectId();
  const bankB = new mongoose.Types.ObjectId();
  const mk = (bankId) => ({
    kind: 'mcq', sourceKey: String(bankId), refId: bankId,
    prompt: 'What is the time complexity of binary search?', answer: 'O(log n)',
    explanation: 'P8-VERIFY', category: 'dsa', difficulty: 'medium', company: 'Google',
  });

  const added1 = await upsertReviewItems(user._id, [mk(bankA), mk(bankB)]);
  assert(added1 === 2, `two distinct wrong questions create two review items (added ${added1})`);
  const tagged = await ReviewItem.findOne({ user: user._id, sourceKey: String(bankA) });
  assert(tagged && tagged.company === 'Google', 'review item is tagged with the company');
  assert(tagged.kind === 'mcq' && tagged.answer === 'O(log n)', 'review item snapshots prompt/answer (reseed-proof)');

  // Re-submitting the SAME bankId (e.g. a later game) must NOT create a duplicate
  // — this is the sourceKey-collision guard the design hinges on.
  const added2 = await upsertReviewItems(user._id, [mk(bankA)]);
  assert(added2 === 0, 'same QuestionBank id across games dedups (no duplicate review item)');
  const count = await ReviewItem.countDocuments({ user: user._id, explanation: 'P8-VERIFY' });
  assert(count === 2, `exactly two review items exist after the dup attempt (got ${count})`);

  console.log('\nP8 TARGETED GAME: ALL CHECKS PASSED');
  await ReviewItem.deleteMany({ user: user._id, explanation: 'P8-VERIFY' });
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
