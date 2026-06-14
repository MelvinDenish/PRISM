const express = require('express');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const LearningPath = require('../models/LearningPath');
const User = require('../models/User');
const { createLearningPath } = require('../agent/services/learningPath');
const { generatePathTest } = require('../agent/services/pathTest');
const { gradeMcqRound } = require('../utils/interviewGameScoring');
const { normOut } = require('../utils/codingProblems');
const { executeCode } = require('./codeExecution');
const router = express.Router();

const fail = (res, err) => res.status(err.statusCode || 500).json({
  success: false,
  message: err.statusCode ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message),
});

// Strip the SERVER-ONLY answer key from a path before returning it to the client
// (mirrors sanitizeGame for the Interview Game). The MCQ answers / coding test
// cases in finalTest.servedKey must never leave the server.
function sanitizePath(path) {
  if (!path) return path;
  const obj = typeof path.toObject === 'function' ? path.toObject() : { ...path };
  if (obj.finalTest) {
    // eslint-disable-next-line no-unused-vars
    const { servedKey, ...rest } = obj.finalTest;
    obj.finalTest = rest;
  }
  return obj;
}

// GET user's learning paths
router.get('/', protect, async (req, res) => {
  try {
    const paths = await LearningPath.find({ user: req.user._id }).populate('topic', 'name').sort({ createdAt: -1 });
    res.json({ success: true, paths: paths.map(sanitizePath) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET /certificate/:certId — PUBLIC verification (no auth). Returns ONLY the
// non-sensitive achievement facts. Declared before GET /:id so 'certificate'
// isn't captured as a path id.
router.get('/certificate/:certId', async (req, res) => {
  try {
    const path = await LearningPath.findOne({ 'certificate.certId': req.params.certId, 'certificate.issued': true })
      .populate('topic', 'name').populate('user', 'name').lean();
    if (!path) return res.status(404).json({ success: false, message: 'Certificate not found' });
    res.json({
      success: true,
      certificate: {
        certId: path.certificate.certId,
        name: path.user?.name || 'PRISM Learner',
        topic: path.topic?.name || path.title || 'Learning Path',
        bestScore: path.bestScore || 0,
        issuedAt: path.certificate.issuedAt,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET specific path
router.get('/:id', protect, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });
    res.json({ success: true, path: sanitizePath(path) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GENERATE learning path with AI. The generation/persistence logic lives in the
// shared service (server/agent/services/learningPath.js) so the assistant's
// create_learning_path tool produces identical roadmaps.
router.post('/generate', protect, aiLimiter, async (req, res) => {
  try {
    const { topicId, level = 'beginner', assessmentAnswers } = req.body;
    const path = await createLearningPath({ userId: req.user._id, topicId, level, assessmentAnswers });
    res.status(201).json({ success: true, path });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message),
    });
  }
});

// UPDATE step progress
router.patch('/:id/progress', protect, async (req, res) => {
  try {
    const { stepIndex, completed } = req.body;
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id });
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });

    if (path.steps[stepIndex]) {
      path.steps[stepIndex].completed = completed;
      if (completed) path.steps[stepIndex].completedAt = new Date();
    }

    path.completedSteps = path.steps.filter(s => s.completed).length;
    const denom = path.totalSteps || path.steps.length || 0;
    path.progress = denom > 0 ? Math.round((path.completedSteps / denom) * 100) : 0;
    await path.save();

    res.json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// POST /:id/test/generate — build the final test from the path's resources.
// Gated behind completing the content steps (the test caps the journey).
router.post('/:id/test/generate', protect, aiLimiter, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });

    const total = path.totalSteps || path.steps.length || 0;
    const done = path.steps.filter((s) => s.completed).length;
    if (total > 0 && done < total) {
      return res.status(400).json({ success: false, message: `Complete all ${total} steps before taking the final test (${done}/${total} done).` });
    }

    const { format, questions, servedKey } = await generatePathTest(path);
    path.finalTest = { generated: true, format, questions, servedKey, generatedAt: new Date() };
    await path.save();
    res.json({ success: true, path: sanitizePath(path) });
  } catch (err) { fail(res, err); }
});

// GET /:id/test — the client-safe test (no answer key).
router.get('/:id/test', protect, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });
    if (!path.finalTest?.generated) return res.status(404).json({ success: false, message: 'No test generated yet' });
    res.json({ success: true, path: sanitizePath(path) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// POST /:id/test/submit — server-authoritative grading. MCQ via gradeMcqRound;
// coding via executeCode over the hidden test cases. >= passThreshold → pass +
// issue a verifiable certificate (once).
router.post('/:id/test/submit', protect, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });
    const test = path.finalTest;
    if (!test?.generated) return res.status(400).json({ success: false, message: 'No test to submit' });

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    let score = 0;

    if (test.format === 'coding') {
      // answers: [{ id, language, code }]. Each problem 0..100 on its hidden tests; round = mean.
      const byId = new Map(answers.filter((a) => a && a.id != null).map((a) => [String(a.id), a]));
      let pctSum = 0;
      const probs = test.servedKey || [];
      for (const prob of probs) {
        const sub = byId.get(String(prob.id));
        const tests = prob.testCases || [];
        if (!sub || !sub.code || !tests.length) continue;
        const language = String(sub.language || 'python');
        let passed = 0;
        for (const tc of tests) {
          try {
            const out = await executeCode(language, sub.code, tc.input || '');
            if (out && out.exitCode === 0 && normOut(out.stdout) === normOut(tc.expectedOutput)) passed += 1;
          } catch (_) { /* a failing test simply doesn't count */ }
        }
        pctSum += tests.length ? (passed / tests.length) * 100 : 0;
      }
      score = probs.length ? Math.round(pctSum / probs.length) : 0;
    } else {
      // MCQ: grade against the stored answer key (servedKey [{id, ans}]).
      const served = (test.servedKey || []).map((k) => ({ questionId: k.id, ans: k.ans }));
      const submitted = answers.map((a) => ({ questionId: a.id ?? a.questionId, selectedAnswer: a.selectedAnswer ?? a.answer }));
      score = gradeMcqRound(served, submitted).score;
    }

    const threshold = path.passThreshold || 90;
    const passed = score >= threshold;

    path.attempts.push({ score, passed, answers, takenAt: new Date() });
    if (score > (path.bestScore || 0)) path.bestScore = score;

    let justIssued = false;
    if (passed && !path.passed) {
      path.passed = true;
      path.passedAt = new Date();
      if (!path.certificate?.issued) {
        path.certificate = { issued: true, certId: crypto.randomUUID(), issuedAt: new Date() };
        justIssued = true;
      }
    }
    await path.save();

    res.json({
      success: true,
      score, passed, threshold,
      bestScore: path.bestScore,
      certificate: path.passed ? path.certificate : undefined,
      justIssued,
      path: sanitizePath(path),
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// DELETE path
router.delete('/:id', protect, async (req, res) => {
  try {
    await LearningPath.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Path deleted' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
// Exposed for the Phase-2 verify script to exercise sanitization without HTTP.
module.exports.sanitizePath = sanitizePath;
