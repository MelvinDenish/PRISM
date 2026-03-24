const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Piston API — supports both self-hosted (localhost:2000) and public (emkc.org)
const SELF_HOSTED_URL = 'http://localhost:2000/api/v2';
const PUBLIC_URL = 'https://emkc.org/api/v2/piston';

let pistonUrl = null; // resolved on first request

// Resolve which Piston instance to use
const getPistonUrl = async () => {
    if (pistonUrl) return pistonUrl;
    // Try self-hosted first
    try {
        await axios.get(`${SELF_HOSTED_URL}/runtimes`, { timeout: 2000 });
        pistonUrl = SELF_HOSTED_URL;
        console.log('✅ Using self-hosted Piston at localhost:2000');
        return pistonUrl;
    } catch {}
    // Fall back to public API
    pistonUrl = PUBLIC_URL;
    console.log('📡 Using public Piston API (emkc.org)');
    return pistonUrl;
};

// Language map: our id → Piston language + version
const LANGUAGE_MAP = {
    'javascript': { language: 'javascript', version: '18.15.0' },
    'python':     { language: 'python',     version: '3.10.0'  },
    'cpp':        { language: 'c++',        version: '10.2.0'  },
    'java':       { language: 'java',       version: '15.0.2'  },
    'c':          { language: 'c',          version: '10.2.0'  },
    'typescript': { language: 'typescript', version: '5.0.3'   },
    'go':         { language: 'go',         version: '1.16.2'  },
    'rust':       { language: 'rust',       version: '1.68.2'  },
    'ruby':       { language: 'ruby',       version: '3.0.1'   },
    'csharp':     { language: 'csharp',     version: '6.12.0'  },
};

// POST /api/code-execution/submit — Execute single code
router.post('/submit', protect, async (req, res) => {
    try {
        const { sourceCode, language, stdin } = req.body;
        const langConfig = LANGUAGE_MAP[language];
        if (!sourceCode || !langConfig) {
            return res.status(400).json({ success: false, message: 'Source code and valid language are required' });
        }

        const url = await getPistonUrl();
        const result = await axios.post(`${url}/execute`, {
            language: langConfig.language,
            version: langConfig.version,
            files: [{ content: sourceCode }],
            stdin: stdin || '',
            compile_timeout: 10000,
            run_timeout: 5000,
        }, { timeout: 20000 });

        const data = result.data;
        res.json({
            success: true,
            result: {
                stdout: data.run?.stdout || '',
                stderr: data.run?.stderr || data.compile?.stderr || '',
                status: data.run?.code === 0 ? 'Accepted' : 'Error',
                exitCode: data.run?.code,
                compileOutput: data.compile?.output || ''
            }
        });
    } catch (err) {
        console.error('Piston execute error:', err.message);
        // Reset URL cache so next request retries self-hosted
        pistonUrl = null;
        res.status(500).json({ success: false, message: 'Code execution failed: ' + err.message });
    }
});

// POST /api/code-execution/run-tests — Run code against multiple test cases
router.post('/run-tests', protect, async (req, res) => {
    try {
        const { sourceCode, language, testCases } = req.body;
        const langConfig = LANGUAGE_MAP[language];

        if (!sourceCode || !langConfig || !testCases?.length) {
            return res.status(400).json({ success: false, message: 'Source code, language, and test cases required' });
        }

        const url = await getPistonUrl();
        const testResults = [];

        for (const tc of testCases) {
            try {
                const result = await axios.post(`${url}/execute`, {
                    language: langConfig.language,
                    version: langConfig.version,
                    files: [{ content: sourceCode }],
                    stdin: tc.input || '',
                    compile_timeout: 10000,
                    run_timeout: 5000,
                }, { timeout: 15000 });

                const data = result.data;
                const actualOutput = (data.run?.stdout || '').trim();
                const expectedOutput = (tc.expectedOutput || '').trim();
                const passed = actualOutput === expectedOutput;
                const hasError = data.run?.stderr || data.compile?.stderr;

                testResults.push({
                    testCase: testResults.length + 1,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    actualOutput,
                    passed,
                    status: hasError ? 'Runtime Error' : passed ? 'Accepted' : 'Wrong Answer',
                    time: data.run?.time || null,
                    error: data.run?.stderr || data.compile?.stderr || null
                });
            } catch (execErr) {
                testResults.push({
                    testCase: testResults.length + 1,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    actualOutput: '',
                    passed: false,
                    status: 'Execution Error',
                    error: execErr.message
                });
            }
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
        console.error('Piston batch error:', err.message);
        pistonUrl = null;
        res.status(500).json({ success: false, message: 'Code execution failed: ' + err.message });
    }
});

// POST /api/code-execution/run-custom — Run code with custom stdin
router.post('/run-custom', protect, async (req, res) => {
    try {
        const { sourceCode, language, stdin } = req.body;
        const langConfig = LANGUAGE_MAP[language];
        if (!sourceCode || !langConfig) {
            return res.status(400).json({ success: false, message: 'Source code and language required' });
        }
        const url = await getPistonUrl();
        const result = await axios.post(`${url}/execute`, {
            language: langConfig.language,
            version: langConfig.version,
            files: [{ content: sourceCode }],
            stdin: stdin || '',
            compile_timeout: 10000,
            run_timeout: 5000,
        }, { timeout: 20000 });

        const data = result.data;
        res.json({
            success: true,
            output: data.run?.stdout || '',
            error: data.run?.stderr || data.compile?.stderr || '',
            exitCode: data.run?.code
        });
    } catch (err) {
        pistonUrl = null;
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/code-execution/languages
router.get('/languages', protect, async (req, res) => {
    try {
        const url = await getPistonUrl();
        const response = await axios.get(`${url}/runtimes`, { timeout: 5000 });
        res.json({ success: true, languages: response.data });
    } catch {
        const languages = Object.entries(LANGUAGE_MAP).map(([id, config]) => ({
            id, language: config.language, version: config.version
        }));
        res.json({ success: true, languages });
    }
});

module.exports = router;
