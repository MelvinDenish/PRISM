const express = require('express');
const CodingQuestion = require('../models/CodingQuestion');
const CodeSubmission = require('../models/CodeSubmission');
const { protect, authorize } = require('../middleware/auth');
const { codeExecLimiter } = require('../middleware/rateLimit');
const { gradeSubmission } = require('../utils/codingGrader');
const { emit: emitSignals } = require('../agent/services/signals');
const router = express.Router();

const errMsg = (error) => (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message);

// Fields that must never reach the client (they ARE the answer key).
const HIDDEN = '-testCases -referenceSolution';

// Decorate a lean question doc with a `gradeable` flag without leaking the
// hidden test cases used to compute it.
const toPublic = (q, gradeable) => {
    const { testCases, referenceSolution, ...rest } = q;
    return { ...rest, gradeable };
};

// GET /api/coding-questions
router.get('/', protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.difficulty) filter.difficulty = req.query.difficulty;
        if (req.query.topic) filter.topic = req.query.topic;
        if (req.query.company) filter.companyTags = req.query.company;
        if (req.query.category) filter.category = req.query.category;

        const questions = await CodingQuestion.find(filter)
            .populate('topic', 'name')
            .populate('companyTags', 'name')
            .sort({ difficulty: 1, createdAt: -1 })
            .lean();

        const out = questions.map((q) => toPublic(q, !!(q.verified && q.testCases?.length)));
        res.json({ success: true, questions: out });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// GET /api/coding-questions/progress  — solved state / streak / per-difficulty
// (declared before /:id so it isn't captured as an id).
router.get('/progress', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Solved = at least one fully-passing submission for that question.
        const solvedIds = await CodeSubmission.distinct('question', { user: userId, passed: true });
        const solvedSet = solvedIds.map((id) => String(id));

        const totals = await CodingQuestion.aggregate([
            { $match: { verified: true } },
            { $group: { _id: '$difficulty', total: { $sum: 1 } } },
        ]);
        const solvedByDiff = await CodingQuestion.aggregate([
            { $match: { _id: { $in: solvedIds } } },
            { $group: { _id: '$difficulty', solved: { $sum: 1 } } },
        ]);
        const byDifficulty = {};
        for (const t of totals) byDifficulty[t._id || 'unknown'] = { total: t.total, solved: 0 };
        for (const s of solvedByDiff) {
            byDifficulty[s._id || 'unknown'] = byDifficulty[s._id || 'unknown'] || { total: 0, solved: 0 };
            byDifficulty[s._id || 'unknown'].solved = s.solved;
        }
        const totalCount = totals.reduce((a, t) => a + t.total, 0);

        // Streak: count consecutive days (ending today or yesterday) with at least
        // one accepted submission. Derived, not stored.
        const passedSubs = await CodeSubmission.find({ user: userId, passed: true })
            .select('submittedAt')
            .sort({ submittedAt: -1 })
            .lean();
        const dayKey = (d) => {
            const x = new Date(d);
            return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
        };
        const days = new Set(passedSubs.map((s) => dayKey(s.submittedAt)));
        let streak = 0;
        const cursor = new Date();
        // Allow the streak to "start" today or yesterday so a not-yet-practiced
        // today doesn't zero out an active streak.
        if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
        while (days.has(dayKey(cursor))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        const recent = await CodeSubmission.find({ user: userId })
            .select('question status score passed submittedAt')
            .populate('question', 'title difficulty')
            .sort({ submittedAt: -1 })
            .limit(10)
            .lean();

        res.json({
            success: true,
            solvedCount: solvedSet.length,
            totalCount,
            solvedIds: solvedSet,
            byDifficulty,
            streak,
            recent,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// GET /api/coding-questions/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const question = await CodingQuestion.findById(req.params.id)
            .populate('topic', 'name')
            .populate('companyTags', 'name')
            .lean();
        if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
        res.json({ success: true, question: toPublic(question, !!(question.verified && question.testCases?.length)) });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// GET /api/coding-questions/:id/submissions — this user's history for a problem
router.get('/:id/submissions', protect, async (req, res) => {
    try {
        const submissions = await CodeSubmission.find({ user: req.user._id, question: req.params.id })
            .select('language status score passed passedCount totalCount submittedAt')
            .sort({ submittedAt: -1 })
            .limit(20)
            .lean();
        res.json({ success: true, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// POST /api/coding-questions/:id/submit — server-authoritative grading.
// The grade is computed against the problem's OWN hidden, reference-verified test
// cases (never client-supplied), then recorded as a CodeSubmission.
router.post('/:id/submit', codeExecLimiter, protect, async (req, res) => {
    try {
        const { code, language } = req.body;
        if (!code || !language) {
            return res.status(400).json({ success: false, message: 'Code and language are required' });
        }

        const problem = await CodingQuestion.findById(req.params.id);
        if (!problem) return res.status(404).json({ success: false, message: 'Question not found' });
        if (!problem.verified || !problem.testCases?.length) {
            return res.status(400).json({ success: false, message: 'This problem is not gradeable yet (no verified test cases).' });
        }

        const graded = await gradeSubmission({ testCases: problem.testCases, language, code });
        const firstFail = graded.results.find((r) => !r.passed);

        await CodeSubmission.create({
            question: problem._id,
            user: req.user._id,
            code,
            language,
            output: firstFail ? firstFail.actualOutput : (graded.results[0]?.actualOutput || ''),
            error: firstFail ? firstFail.error : null,
            passed: graded.passed,
            passedCount: graded.passedCount,
            totalCount: graded.totalCount,
            status: graded.status,
            score: graded.score,
        });
        // P6 spine: every graded submission is dsa evidence (category = skill tag).
        await emitSignals(req.user._id, [{
            pillar: 'dsa',
            skill: problem.category || 'coding',
            score: (Number(graded.score) || 0) / 100,
            source: 'coding',
            sourceId: problem._id,
        }]);

        // Only reveal expected/actual for FAILED tests (pedagogically useful when
        // you got it wrong). Passing tests return pass-only so a single submit
        // can't exfiltrate the full hidden answer key — matters once solved-state
        // feeds anything competitive (leaderboard/percentile, C6/C8).
        const safeResults = graded.results.map((r, i) =>
            r.passed
                ? { index: i + 1, passed: true }
                : { index: i + 1, passed: false, input: r.input, expectedOutput: r.expectedOutput, actualOutput: r.actualOutput, error: r.error });

        res.json({
            success: true,
            passed: graded.passed,
            passedCount: graded.passedCount,
            totalCount: graded.totalCount,
            score: graded.score,
            status: graded.status,
            results: safeResults,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// POST /api/coding-questions
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const question = await CodingQuestion.create(req.body);
        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// PUT /api/coding-questions/:id
router.put('/:id', protect, authorize('mentor', 'admin'), async (req, res) => {
    try {
        const question = await CodingQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

// DELETE /api/coding-questions/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await CodingQuestion.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: errMsg(error) });
    }
});

module.exports = router;
