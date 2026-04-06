const express = require('express');
const CodeSubmission = require('../models/CodeSubmission');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Judge0 CE self-hosted URL (docker-compose -f judge0-docker-compose.yml up -d)
const JUDGE0_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';

// POST /api/code-submissions - Submit code via self-hosted Judge0 CE
router.post('/', protect, async (req, res) => {
    try {
        const { mockInterview, question, code, language } = req.body;

        let output = '';
        let error = '';
        let score = 0;

        const langMap = { 'javascript': 63, 'python': 71, 'java': 62, 'cpp': 54, 'c': 50 };
        const languageId = langMap[language] || 63;

        try {
            // Submit to self-hosted Judge0 (no API key needed)
            const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_code: code, language_id: languageId, stdin: '' })
            });
            const result = await response.json();
            output = result.stdout || '';
            error = result.stderr || result.compile_output || '';
            score = (result.status && result.status.id === 3) ? 100 : 0; // 3 = Accepted
        } catch (execErr) {
            error = `Judge0 service unavailable. Run: docker-compose -f judge0-docker-compose.yml up -d | Error: ${execErr.message}`;
        }

        const submission = await CodeSubmission.create({
            mockInterview, question, user: req.user._id, code, language, output, error, score
        });

        res.status(201).json({ success: true, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/code-submissions/interview/:interviewId
router.get('/interview/:interviewId', protect, async (req, res) => {
    try {
        const submissions = await CodeSubmission.find({ mockInterview: req.params.interviewId })
            .populate('user', 'name')
            .populate('question', 'title');
        res.json({ success: true, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/code-submissions/my
router.get('/my', protect, async (req, res) => {
    try {
        const submissions = await CodeSubmission.find({ user: req.user._id })
            .populate('question', 'title')
            .sort({ submittedAt: -1 });
        res.json({ success: true, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
