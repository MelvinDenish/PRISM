const express = require('express');
const CodeSubmission = require('../models/CodeSubmission');
const { protect } = require('../middleware/auth');
const router = express.Router();

// POST /api/code-submissions - Submit code (with optional Judge0 execution)
router.post('/', protect, async (req, res) => {
    try {
        const { mockInterview, question, code, language } = req.body;

        let output = '';
        let error = '';

        // Try Judge0 execution if API key is configured
        if (process.env.JUDGE0_API_KEY && process.env.JUDGE0_API_KEY !== 'your_judge0_api_key_here') {
            try {
                const langMap = { 'javascript': 63, 'python': 71, 'java': 62, 'cpp': 54, 'c': 50 };
                const languageId = langMap[language] || 63;

                const response = await fetch(`${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
                        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                    },
                    body: JSON.stringify({ source_code: code, language_id: languageId, stdin: '' })
                });
                const result = await response.json();
                output = result.stdout || '';
                error = result.stderr || result.compile_output || '';
            } catch (execErr) {
                error = `Execution service unavailable: ${execErr.message}`;
            }
        } else {
            output = 'Code execution service not configured. Set JUDGE0_API_KEY in .env';
        }

        const submission = await CodeSubmission.create({
            mockInterview, question, user: req.user._id, code, language, output, error
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
