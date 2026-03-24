const express = require('express');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Execute code locally using child_process
const executeCode = (language, sourceCode, stdin = '') => {
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
                    args = [filePath];
                    break;
                }
                case 'python': {
                    filePath = path.join(tmpDir, `${id}.py`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath);
                    command = 'python';
                    args = [filePath];
                    break;
                }
                case 'cpp': {
                    filePath = path.join(tmpDir, `${id}.cpp`);
                    const outPath = path.join(tmpDir, `${id}.exe`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath, outPath);
                    // Compile then run
                    exec(`g++ "${filePath}" -o "${outPath}" 2>&1`, { timeout: 10000 }, (compErr, compOut, compStderr) => {
                        if (compErr) {
                            cleanup(cleanupFiles);
                            return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 });
                        }
                        const child = execFile(outPath, [], { timeout: 5000 }, (err, stdout, stderr) => {
                            cleanup(cleanupFiles);
                            resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code || 1 : 0 });
                        });
                        if (stdin) child.stdin.write(stdin);
                        child.stdin.end();
                    });
                    return; // async handled above
                }
                case 'c': {
                    filePath = path.join(tmpDir, `${id}.c`);
                    const outPathC = path.join(tmpDir, `${id}.exe`);
                    fs.writeFileSync(filePath, sourceCode);
                    cleanupFiles.push(filePath, outPathC);
                    exec(`gcc "${filePath}" -o "${outPathC}" 2>&1`, { timeout: 10000 }, (compErr, compOut, compStderr) => {
                        if (compErr) {
                            cleanup(cleanupFiles);
                            return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 });
                        }
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
                    // Java needs class name = Main
                    const javaCode = sourceCode.includes('class Main') ? sourceCode : sourceCode.replace(/class\s+\w+/, 'class Main');
                    const javaDir = path.join(tmpDir, id);
                    fs.mkdirSync(javaDir, { recursive: true });
                    filePath = path.join(javaDir, 'Main.java');
                    fs.writeFileSync(filePath, javaCode);
                    cleanupFiles.push(javaDir);
                    exec(`javac "${filePath}" 2>&1`, { timeout: 15000 }, (compErr, compOut, compStderr) => {
                        if (compErr) {
                            cleanupDir(javaDir);
                            return resolve({ stdout: '', stderr: compOut || compStderr || compErr.message, exitCode: 1 });
                        }
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
                    return resolve({ stdout: '', stderr: `Language "${language}" not supported for local execution`, exitCode: 1 });
            }

            // For interpreted languages (JS, Python)
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
