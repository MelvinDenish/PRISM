const express = require('express');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Execute code via Judge0 CE (primary) with local fallback
const JUDGE0_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';
const LANG_MAP = { 'javascript': 63, 'python': 71, 'java': 62, 'cpp': 54, 'c': 50 };
const MAX_CODE_LENGTH = 50000; // 50KB max code size
const EXEC_TIMEOUT = 10000; // 10s max execution time

// Security: Block dangerous code patterns
const DANGEROUS_PATTERNS = {
    javascript: [
        /require\s*\(\s*['"](?:fs|child_process|net|http|https|os|cluster|dgram|dns|tls|vm|worker_threads|perf_hooks)['"]\s*\)/i,
        /process\.env/i,
        /process\.exit/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /import\s*\(/i,
        /\bexecSync\b|\bspawnSync\b|\bexec\b.*require/i,
    ],
    python: [
        /import\s+(?:os|subprocess|sys|shutil|socket|http|urllib|requests|ctypes)\b/i,
        /from\s+(?:os|subprocess|sys|shutil|socket)\s+import/i,
        /exec\s*\(/i,
        /__import__\s*\(/i,
        /open\s*\(.*['"]\s*(?:\/etc|\/proc|\.\.)/i,
    ],
    cpp: [/system\s*\(/i, /popen\s*\(/i, /exec[lv]?p?\s*\(/i],
    c: [/system\s*\(/i, /popen\s*\(/i, /exec[lv]?p?\s*\(/i],
    java: [/Runtime\.getRuntime\(\)\.exec/i, /ProcessBuilder/i, /System\.exit/i],
};

const validateCode = (language, sourceCode) => {
    if (sourceCode.length > MAX_CODE_LENGTH) {
        return 'Code exceeds maximum length of 50KB';
    }
    const patterns = DANGEROUS_PATTERNS[language] || [];
    for (const pattern of patterns) {
        if (pattern.test(sourceCode)) {
            return 'Code contains restricted operations (file system access, network calls, or system commands are not allowed)';
        }
    }
    return null;
};

const executeCode = async (language, sourceCode, stdin = '') => {
    // Validate code first
    const validationError = validateCode(language, sourceCode);
    if (validationError) {
        return { stdout: '', stderr: validationError, exitCode: 1 };
    }

    // Try Judge0 first
    try {
        const languageId = LANG_MAP[language];
        if (!languageId) return { stdout: '', stderr: `Language "${language}" not supported`, exitCode: 1 };

        const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_code: sourceCode, language_id: languageId, stdin: stdin || '' })
        });
        const result = await response.json();
        return {
            stdout: result.stdout || '',
            stderr: result.stderr || result.compile_output || '',
            exitCode: (result.status && result.status.id === 3) ? 0 : 1
        };
    } catch (judge0Err) {
        // Judge0 unavailable — fallback to local execution
        return executeLocal(language, sourceCode, stdin);
    }
};

// Local fallback using child_process (only if Judge0 is down)
const executeLocal = (language, sourceCode, stdin = '') => {
    return new Promise((resolve) => {
        const tmpDir = os.tmpdir();
        const id = `prism_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let filePath, command, args, cleanupFiles = [];

        try {
            switch (language) {
                case 'javascript': {
                    filePath = path.join(tmpDir, `${id}.js`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath);
                    command = 'node';
                    args = ['--max-old-space-size=128', filePath];
                    break;
                }
                case 'python': {
                    filePath = path.join(tmpDir, `${id}.py`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath);
                    // Fix 13: Try python3 first, then python
                    command = process.platform === 'win32' ? 'python' : 'python3';
                    args = [filePath];
                    break;
                }
                case 'cpp': {
                    filePath = path.join(tmpDir, `${id}.cpp`);
                    const outPath = path.join(tmpDir, `${id}.exe`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath, outPath);
                    exec(`g++ "${filePath}" -o "${outPath}" 2>&1`, { timeout: 10000 }, (compErr, compOut, compStderr) => {
                        if (compErr) { cleanup(cleanupFiles); return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 }); }
                        const child = execFile(outPath, [], { timeout: 5000 }, (err, stdout, stderr) => {
                            cleanup(cleanupFiles);
                            resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code || 1 : 0 });
                        });
                        if (stdin) child.stdin.write(stdin);
                        child.stdin.end();
                    });
                    return;
                }
                case 'c': {
                    filePath = path.join(tmpDir, `${id}.c`);
                    const outPathC = path.join(tmpDir, `${id}.exe`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath, outPathC);
                    exec(`gcc "${filePath}" -o "${outPathC}" 2>&1`, { timeout: 10000 }, (compErr, compOut, compStderr) => {
                        if (compErr) { cleanup(cleanupFiles); return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 }); }
                        const child = execFile(outPathC, [], { timeout: 5000 }, (err, stdout, stderr) => {
                            cleanup(cleanupFiles);
                            resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code || 1 : 0 });
                        });
                        if (stdin) child.stdin.write(stdin);
                        child.stdin.end();
                    });
                    return;
                }
                case 'java': {
                    const javaCode = sourceCode.includes('class Main') ? sourceCode : sourceCode.replace(/class\s+\w+/, 'class Main');
                    const javaDir = path.join(tmpDir, id);
                    fs.mkdirSync(javaDir, { recursive: true });
                    filePath = path.join(javaDir, 'Main.java');
                    fs.writeFileSync(filePath, javaCode);
                    cleanupFiles.push(javaDir);
                    exec(`javac "${filePath}" 2>&1`, { timeout: 15000 }, (compErr, compOut, compStderr) => {
                        if (compErr) { cleanupDir(javaDir); return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 }); }
                        const child = exec(`java -cp "${javaDir}" Main`, { timeout: 5000 }, (err, stdout, stderr) => {
                            cleanupDir(javaDir);
                            resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code || 1 : 0 });
                        });
                        if (stdin) child.stdin.write(stdin);
                        child.stdin.end();
                    });
                    return;
                }
                default:
                    return resolve({ stdout: '', stderr: `Language "${language}" not supported`, exitCode: 1 });
            }

            const child = execFile(command, args, { timeout: 5000 }, (err, stdout, stderr) => {
                cleanup(cleanupFiles);
                resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code || 1 : 0 });
            });
            if (stdin) child.stdin.write(stdin);
            child.stdin.end();
        } catch (err) {
            cleanup(cleanupFiles);
            resolve({ stdout: '', stderr: err.message, exitCode: 1 });
        }
    });
};

const cleanup = (files) => {
    files.forEach(f => { try { fs.unlinkSync(f); } catch {} });
};

const cleanupDir = (dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

// POST /api/code-execution/submit
router.post('/submit', protect, async (req, res) => {
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
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/code-execution/run-tests
router.post('/run-tests', protect, async (req, res) => {
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
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/code-execution/run-custom
router.post('/run-custom', protect, async (req, res) => {
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
        res.status(500).json({ success: false, message: err.message });
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

module.exports = router;
