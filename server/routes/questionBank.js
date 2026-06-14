const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const QuestionBank = require('../models/QuestionBank');
const { verifyProblem } = require('../utils/codingGrader');
const router = express.Router();

// Mentor/admin-managed, company-tagged Question Bank (Phase 3). Mentors upload
// real past-interview questions for a company; these are preferred over generic
// curated questions when a candidate targets that company in the Interview Game.

const fail = (res, err) => res.status(err.statusCode || 500).json({
  success: false,
  message: err.statusCode ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message),
});

const TYPES = ['aptitude', 'technical', 'hr', 'coding'];
const DIFFS = ['easy', 'medium', 'hard'];

// Build a validated bank doc from mentor input. Coding questions are
// reference-verified here (same guarantee as seeds) — an unverifiable coding
// question is rejected so it can never grade a candidate against a bad key.
async function buildDoc(body) {
  const type = TYPES.includes(body.type) ? body.type : null;
  if (!type) { const e = new Error('type must be one of aptitude|technical|hr|coding'); e.statusCode = 400; throw e; }

  const base = {
    type,
    category: typeof body.category === 'string' ? body.category.slice(0, 60) : undefined,
    difficulty: DIFFS.includes(body.difficulty) ? body.difficulty : 'medium',
    source: 'mentor',
    companyTag: mongoose.isValidObjectId(body.companyTag) ? body.companyTag : undefined,
    year: Number.isFinite(Number(body.year)) ? Number(body.year) : undefined,
    verified: true,
  };

  if (type === 'aptitude' || type === 'technical') {
    const opts = Array.isArray(body.opts) ? body.opts.map(String).filter(Boolean) : [];
    if (!body.q || opts.length < 2 || !body.ans || !opts.includes(String(body.ans))) {
      const e = new Error('MCQ needs q, at least 2 opts, and an ans that is one of the opts'); e.statusCode = 400; throw e;
    }
    return { ...base, q: String(body.q), opts, ans: String(body.ans), explanation: body.explanation ? String(body.explanation) : undefined };
  }

  if (type === 'hr') {
    if (!body.q || !String(body.q).trim()) { const e = new Error('HR question needs a q'); e.statusCode = 400; throw e; }
    return { ...base, q: String(body.q).trim() };
  }

  // coding — verify the reference against the provided inputs before trusting it.
  const reference = body.referenceSolution || body.reference;
  const testInputs = Array.isArray(body.testInputs) ? body.testInputs
    : (Array.isArray(body.testCases) ? body.testCases.map((t) => t.input) : []);
  if (!body.title || !body.description || !reference || !testInputs.length) {
    const e = new Error('Coding question needs title, description, a Python referenceSolution, and testInputs'); e.statusCode = 400; throw e;
  }
  const { testCases, verified, reason } = await verifyProblem({ referenceSolution: reference, testInputs });
  if (!verified) { const e = new Error(`Coding reference failed verification: ${reason || 'could not run'}`); e.statusCode = 400; throw e; }
  return {
    ...base,
    title: String(body.title), description: String(body.description),
    examples: Array.isArray(body.examples) ? body.examples : [],
    testCases, referenceSolution: reference,
    boilerplate: body.boilerplate && typeof body.boilerplate === 'object' ? body.boilerplate : undefined,
  };
}

// GET /api/question-bank — list mentor/research questions (filterable). Privileged
// view, so answer keys are included for management.
router.get('/', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const filter = { source: { $in: ['mentor', 'research'] } };
    if (TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (mongoose.isValidObjectId(req.query.companyTag)) filter.companyTag = req.query.companyTag;
    if (['mentor', 'research', 'curated'].includes(req.query.source)) filter.source = req.query.source;
    const questions = await QuestionBank.find(filter).populate('companyTag', 'name').sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, questions });
  } catch (err) { fail(res, err); }
});

// POST /api/question-bank — add a company-tagged question (source:'mentor').
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const doc = await buildDoc(req.body);
    const created = await QuestionBank.create(doc);
    res.status(201).json({ success: true, question: created });
  } catch (err) { fail(res, err); }
});

// PUT /api/question-bank/:id — edit a mentor question (re-validates).
router.put('/:id', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const existing = await QuestionBank.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Question not found' });
    if (existing.source === 'curated') return res.status(403).json({ success: false, message: 'Curated questions are not editable here' });
    const doc = await buildDoc({ ...existing.toObject(), ...req.body });
    const updated = await QuestionBank.findByIdAndUpdate(req.params.id, doc, { new: true });
    res.json({ success: true, question: updated });
  } catch (err) { fail(res, err); }
});

// DELETE /api/question-bank/:id — remove a mentor/research question.
router.delete('/:id', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const q = await QuestionBank.findById(req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
    if (q.source === 'curated') return res.status(403).json({ success: false, message: 'Curated questions are not deletable here' });
    await q.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { fail(res, err); }
});

module.exports = router;
