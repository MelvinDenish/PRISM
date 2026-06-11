const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const ReviewItem = require('../models/ReviewItem');
const InterviewGame = require('../models/InterviewGame');
const CodeSubmission = require('../models/CodeSubmission');
const CodingQuestion = require('../models/CodingQuestion');
const QuestionBank = require('../models/QuestionBank');
const Progress = require('../models/Progress');
const { emit: emitSignals } = require('../agent/services/signals');
const router = express.Router();

const fail = (res, err) => res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });

const isObjectId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === v;

// Build the list of review candidates for a user from the three sources, each as
// a fully-snapshotted upsert payload. Content is captured here so the queue keeps
// rendering after a reseed even though the source ids change.
async function collectCandidates(userId) {
    const candidates = [];

    // ── 1. Missed MCQs (latest answer to a question was wrong) ──
    const games = await InterviewGame.find({ user: userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .select('rounds.answers')
        .lean();
    // First occurrence in completedAt-desc order = the user's most recent verdict.
    const latestVerdict = new Map();
    for (const g of games) {
        for (const r of g.rounds || []) {
            for (const a of r.answers || []) {
                if (!a.questionId || latestVerdict.has(a.questionId)) continue;
                latestVerdict.set(a.questionId, a.isCorrect);
            }
        }
    }
    const wrongIds = [...latestVerdict.entries()]
        .filter(([, correct]) => correct === false)
        .map(([qid]) => qid)
        .filter(isObjectId);
    if (wrongIds.length) {
        const banks = await QuestionBank.find({ _id: { $in: wrongIds } }).lean();
        for (const q of banks) {
            if (!q.q) continue; // only MCQ-shaped rows have a prompt to show
            candidates.push({
                kind: 'mcq', sourceKey: String(q._id), refId: q._id,
                prompt: q.q, answer: q.ans, explanation: q.explanation,
                category: q.category, difficulty: q.difficulty,
            });
        }
    }

    // ── 2. Unsolved coding problems (a failed submission, never an accepted one) ──
    const [failedIds, solvedIds] = await Promise.all([
        CodeSubmission.distinct('question', { user: userId, passed: false, question: { $ne: null } }),
        CodeSubmission.distinct('question', { user: userId, passed: true, question: { $ne: null } }),
    ]);
    const solvedSet = new Set(solvedIds.map(String));
    const unsolved = failedIds.filter((id) => !solvedSet.has(String(id)));
    if (unsolved.length) {
        const problems = await CodingQuestion.find({ _id: { $in: unsolved } }).select('title category difficulty').lean();
        for (const p of problems) {
            candidates.push({
                kind: 'coding', sourceKey: String(p._id), refId: p._id,
                prompt: p.title, explanation: 'Unsolved — failed at least one test case.',
                category: p.category, difficulty: p.difficulty,
            });
        }
    }

    // ── 3. Weak topics (same gap logic as analytics: >20% below the best topic) ──
    const progress = await Progress.findOne({ mentee: userId }).populate('topicProgress.topic', 'name').lean();
    if (progress && progress.topicProgress && progress.topicProgress.length) {
        const pcts = progress.topicProgress.map((t) => t.percentage || 0);
        const maxPct = Math.max(...pcts);
        for (const tp of progress.topicProgress) {
            if (!tp.topic) continue;
            const pct = tp.percentage || 0;
            if (pct < maxPct - 20) {
                candidates.push({
                    kind: 'topic', sourceKey: String(tp.topic._id), refId: tp.topic._id,
                    prompt: tp.topic.name,
                    explanation: `Lagging topic — ${pct}% complete (${maxPct - pct}% behind your strongest).`,
                    category: 'topic', difficulty: null,
                });
            }
        }
    }

    return candidates;
}

// Idempotent: insert any new candidates (preserving the schedule of existing ones
// via $setOnInsert). Returns how many were newly added.
async function populate(userId) {
    const candidates = await collectCandidates(userId);
    if (!candidates.length) return 0;
    const now = new Date();
    const ops = candidates.map((c) => ({
        updateOne: {
            filter: { user: userId, kind: c.kind, sourceKey: c.sourceKey },
            update: { $setOnInsert: { ...c, user: userId, box: 1, dueAt: now, mastered: false, timesReviewed: 0, createdAt: now, updatedAt: now } },
            upsert: true,
        },
    }));
    const result = await ReviewItem.bulkWrite(ops, { ordered: false });
    return result.upsertedCount || 0;
}

// POST /api/review/refresh — rescan sources and add any new review items.
router.post('/refresh', protect, async (req, res) => {
    try {
        const added = await populate(req.user._id);
        res.json({ success: true, added });
    } catch (err) { fail(res, err); }
});

// GET /api/review/queue — items due now (auto-refreshes first, idempotently).
router.get('/queue', protect, async (req, res) => {
    try {
        await populate(req.user._id);
        const items = await ReviewItem.find({ user: req.user._id, mastered: false, dueAt: { $lte: new Date() } })
            .sort({ dueAt: 1 })
            .limit(50)
            .lean();
        res.json({ success: true, items });
    } catch (err) { fail(res, err); }
});

// GET /api/review/stats — queue health for the page header.
router.get('/stats', protect, async (req, res) => {
    try {
        const now = new Date();
        const [due, active, mastered] = await Promise.all([
            ReviewItem.countDocuments({ user: req.user._id, mastered: false, dueAt: { $lte: now } }),
            ReviewItem.countDocuments({ user: req.user._id, mastered: false }),
            ReviewItem.countDocuments({ user: req.user._id, mastered: true }),
        ]);
        res.json({ success: true, stats: { due, active, mastered } });
    } catch (err) { fail(res, err); }
});

// P6 spine: ReviewItem.kind → readiness pillar. MCQ items split on category —
// aptitude-bank questions feed 'aptitude', everything else is core CS.
const pillarForItem = (item) => {
    if (item.kind === 'coding') return 'dsa';
    if (item.kind === 'topic') return 'cs_core';
    return String(item.category || '').toLowerCase().includes('apt') ? 'aptitude' : 'cs_core';
};

// POST /api/review/:id/review — grade one item (Leitner reschedule).
router.post('/:id/review', protect, async (req, res) => {
    try {
        const remembered = req.body.remembered === true;
        const item = await ReviewItem.findOne({ _id: req.params.id, user: req.user._id });
        if (!item) return res.status(404).json({ success: false, message: 'Review item not found' });
        item.applyReview(remembered);
        await item.save();
        // P6 spine: remembered=1, forgot=0 — low weight (0.75), high frequency.
        await emitSignals(req.user._id, [{
            pillar: pillarForItem(item),
            skill: item.category || item.kind,
            score: remembered ? 1 : 0,
            source: 'review',
            sourceId: item._id,
        }]);
        res.json({ success: true, item });
    } catch (err) { fail(res, err); }
});

// DELETE /api/review/:id — dismiss an item permanently.
router.delete('/:id', protect, async (req, res) => {
    try {
        const deleted = await ReviewItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!deleted) return res.status(404).json({ success: false, message: 'Review item not found' });
        res.json({ success: true, message: 'Dismissed' });
    } catch (err) { fail(res, err); }
});

module.exports = router;
