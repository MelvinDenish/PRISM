const express = require('express');
const { protect } = require('../middleware/auth');
const { codeExecLimiter } = require('../middleware/rateLimit');
const { runSandboxed } = require('../agent/services/codeRun');
const router = express.Router();

// Thin wrapper kept for interviewGame.js compatibility:
//   const { executeCode } = require('./codeExecution') — unchanged public surface.
// runSandboxed already validates, so this is a pass-through with the same return shape.
const executeCode = async (language, sourceCode, stdin = '') => {
    return runSandboxed({ language, code: sourceCode, stdin });
};

// POST /api/code-execution/submit
router.post('/submit', codeExecLimiter, protect, async (req, res) => {
    try {
        const { sourceCode, language, stdin } = req.body;
        if (!sourceCode || !language) {
            return res.status(400).json({ success: false, message: 'Source code and language are required' });
        }
        const result = await executeCode(language, sourceCode, stdin || '');
        res.json({
            success: true,
            result: {
                stdout: result.stdout,
                stderr: result.stderr,
                status: result.exitCode === 0 ? 'Accepted' : 'Error',
                exitCode: result.exitCode
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
    }
});

// POST /api/code-execution/run-tests
router.post('/run-tests', codeExecLimiter, protect, async (req, res) => {
    try {
        const { sourceCode, language, testCases } = req.body;
        if (!sourceCode || !language || !testCases?.length) {
            return res.status(400).json({ success: false, message: 'Source code, language, and test cases required' });
        }

        const testResults = [];
        for (const tc of testCases) {
            const result = await executeCode(language, sourceCode, tc.input || '');
            const actualOutput = (result.stdout || '').trim();
            const expectedOutput = (tc.expectedOutput || '').trim();
            const passed = actualOutput === expectedOutput && result.exitCode === 0;

            testResults.push({
                testCase: testResults.length + 1,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput,
                passed,
                status: result.stderr ? 'Runtime Error' : passed ? 'Accepted' : 'Wrong Answer',
                error: result.stderr || null
            });
        }

        const passedCount = testResults.filter(t => t.passed).length;
        res.json({
            success: true,
            testResults,
            passedCount,
            totalCount: testCases.length,
            score: Math.round((passedCount / testCases.length) * 100)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
    }
});

// POST /api/code-execution/run-custom
router.post('/run-custom', codeExecLimiter, protect, async (req, res) => {
    try {
        const { sourceCode, language, stdin } = req.body;
        if (!sourceCode || !language) {
            return res.status(400).json({ success: false, message: 'Source code and language required' });
        }
        const result = await executeCode(language, sourceCode, stdin || '');
        res.json({
            success: true,
            output: result.stdout || '',
            error: result.stderr || '',
            exitCode: result.exitCode
        });
    } catch (err) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
    }
});

// GET /api/code-execution/languages
router.get('/languages', protect, async (req, res) => {
    res.json({
        success: true,
        languages: [
            { id: 'javascript', name: 'JavaScript (Node.js)' },
            { id: 'python', name: 'Python 3' },
            { id: 'cpp', name: 'C++ (g++)' },
            { id: 'c', name: 'C (gcc)' },
            { id: 'java', name: 'Java' },
        ]
    });
});

// Expose the sandboxed runner so the Interview Game can grade coding rounds
// server-side against hidden test cases (router stays the default export).
router.executeCode = executeCode;
module.exports = router;
