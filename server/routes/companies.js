const express = require('express');
const Company = require('../models/Company');
const CodingQuestion = require('../models/CodingQuestion');
const CodeSubmission = require('../models/CodeSubmission');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { checkEligibility } = require('../utils/eligibility');
const router = express.Router();

// GET /api/companies
router.get('/', async (req, res) => {
    try {
        const companies = await Company.find().sort({ name: 1 });
        res.json({ success: true, companies });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/companies/eligibility — the caller's eligibility for every company.
// MUST be declared before GET /:id so 'eligibility' isn't captured as an id.
// Returns a map keyed by company id → { eligible, unknown, reasons, missing }.
router.get('/eligibility', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('cgpa activeArrears historyArrears tenthPercent twelfthPercent department batch graduationYear').lean();
        const companies = await Company.find().select('name eligibility').lean();
        const result = {};
        for (const c of companies) result[String(c._id)] = checkEligibility(user || {}, c);
        res.json({ success: true, eligibility: result });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/companies/:id/track — company-specific prep track (C1):
// interview pattern + the coding problems tagged to this company, annotated
// with the caller's solved state (reuses C2's CodeSubmission tracking).
router.get('/:id/track', protect, async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

        const problems = await CodingQuestion.find({ companyTags: company._id })
            .select('title difficulty category verified testCases topic')
            .populate('topic', 'name')
            .sort({ difficulty: 1 })
            .lean();

        const solvedIds = await CodeSubmission.distinct('question', { user: req.user._id, passed: true });
        const solvedSet = new Set(solvedIds.map(String));

        const items = problems.map((p) => ({
            _id: p._id,
            title: p.title,
            difficulty: p.difficulty,
            topic: p.topic?.name,
            gradeable: !!(p.verified && p.testCases?.length),
            solved: solvedSet.has(String(p._id)),
        }));
        const solvedCount = items.filter((i) => i.solved).length;

        res.json({
            success: true,
            company: { _id: company._id, name: company.name, description: company.description, interviewPattern: company.interviewPattern, difficultyLevel: company.difficultyLevel },
            problems: items,
            solvedCount,
            totalCount: items.length,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// POST /api/companies
router.post('/', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const company = await Company.create(req.body);
        res.status(201).json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PUT /api/companies/:id — mentor/admin may edit company details + eligibility.
router.put('/:id', protect, authorize('admin', 'mentor'), async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// DELETE /api/companies/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await Company.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Company deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
