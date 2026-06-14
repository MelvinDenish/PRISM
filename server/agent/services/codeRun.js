/**
 * Sandboxed code execution service — shared between the HTTP route
 * (routes/codeExecution.js) and the agent run_code tool.
 *
 * Extracted so both consumers use identical validation and execution logic.
 * Security model: Judge0 (an actual isolation boundary) is the sandbox.
 * DANGEROUS_PATTERNS is a best-effort lint, NOT a sandbox — regex filters
 * are bypassable by construction. That is why executeLocal (raw
 * child_process) is dev-only: in production a Judge0 outage fails closed
 * (see runSandboxed) instead of falling back to unisolated execution.
 * Never bypass validateCode on user-submitted code, but never rely on it
 * as the isolation boundary either.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { config } = require('../../config/env');

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';
const LANG_MAP = { javascript: 63, python: 71, java: 62, cpp: 54, c: 50 };
const MAX_CODE_LENGTH = 50000; // 50KB — used by the HTTP route (preserves existing cap)
const EXEC_TIMEOUT = 10000;    // 10s

// Some coding test-case inputs are authored with the newline ESCAPE written
// literally (the two characters "\" + "n") instead of a real newline — e.g. seed
// data like '3\\nflower\\nflow'. Fed to a program's stdin, that whole thing
// arrives as ONE line, so `int(input())` throws `ValueError`. Convert the common
// literal escapes back to real control chars before they become stdin. This is a
// no-op on data that already uses real newlines (a real newline is one char, not
// the two chars "\"+"n"), so it is safe for every caller.
function normalizeStdin(input) {
  if (typeof input !== 'string' || input.indexOf('\\') === -1) return input || '';
  return input
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

// The local fallback writes the user's code to an OS temp file, so raw tracebacks
// leak an internal path like `C:\…\Temp\prism_1781432374787_dpap2u.py`. Replace any
// such temp artifact reference with a friendly filename so the user sees a clean
// error (e.g. `File "solution.py", line 1`). Needs no knowledge of the exact id.
const TMP_ARTIFACT_RE = /[^\s"']*prism_\d+_[a-z0-9]+(\.[a-z0-9]+)?/gi;
function sanitizeOutput(text) {
  return typeof text === 'string' ? text.replace(TMP_ARTIFACT_RE, (_m, ext) => `solution${ext || ''}`) : text;
}

// JavaScript lint patterns split into two passes (see validateCode / stripNonCode):
//   - jsLiteralPatterns: must inspect STRING CONTENTS, so they run against the
//     original source (strings intact). Matching a string literal like
//     `require('fs')` written inside a JS string is an accepted false positive
//     — literally spelling out a dangerous require is suspicious anyway.
//   - jsStrippedPatterns: run against source with comments & string bodies
//     stripped so honest code (`// require fs`, "You require a permit") isn't
//     rejected.
const jsLiteralPatterns = [
  // Core-module require, with or without the `node:` prefix.
  /require\s*\(\s*['"](?:node:)?(?:fs|child_process|net|http|https|os|cluster|dgram|dns|tls|vm|worker_threads|perf_hooks)\b/i,
  // Any require that is not a single clean string literal — blocks
  // require(x), require('f'+'s'), require(`fs`), require('fs',...).
  /require\s*\(\s*(?!['"][^'"]*['"]\s*\))/i,
];

const jsStrippedPatterns = [
  // Bare `require` reference without an immediate call — blocks aliasing
  // (const r = require; r('fs')).
  /\brequire\b(?!\s*\()/i,
  /process\s*\.\s*(?:env|exit|binding|dlopen|kill)/i,
  /globalThis\s*\[/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /import\s*\(/i,
  /\bexecSync\b|\bspawnSync\b|\bexec\b.*require/i,
];

const DANGEROUS_PATTERNS = {
  javascript: [...jsLiteralPatterns, ...jsStrippedPatterns],
  python: [
    /import\s+(?:os|subprocess|sys|shutil|socket|http|urllib|requests|ctypes|importlib)\b/i,
    /from\s+(?:os|subprocess|sys|shutil|socket|importlib)\s+import/i,
    /\bimportlib\b/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /__import__\s*\(/i,
    /getattr\s*\(\s*__builtins__/i,
    /open\s*\(.*['"]\s*(?:\/etc|\/proc|\.\.)/i,
  ],
  cpp: [/system\s*\(/i, /popen\s*\(/i, /exec[lv]?p?\s*\(/i],
  c:   [/system\s*\(/i, /popen\s*\(/i, /exec[lv]?p?\s*\(/i],
  java: [/Runtime\.getRuntime\(\)\.exec/i, /ProcessBuilder/i, /System\.exit/i],
};

// Strip line/block comments and string/template-literal BODIES so the lint
// patterns run against executable text only (best-effort, not a parser).
function stripNonCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * Validate code against size + dangerous-pattern rules.
 *
 * For JavaScript we run TWO passes:
 *  (a) jsLiteralPatterns against the ORIGINAL source (so we can inspect string
 *      contents like require('fs') module-literals),
 *  (b) jsStrippedPatterns against source with comments and string bodies
 *      stripped (so honest code in comments/strings isn't a false positive).
 *
 * Other languages run their patterns against the original source as before.
 *
 * @returns {string|null}  error message or null if safe
 */
function validateCode(language, sourceCode, maxBytes = MAX_CODE_LENGTH) {
  if (sourceCode.length > maxBytes) {
    return `Code exceeds maximum length of ${Math.round(maxBytes / 1024)}KB`;
  }
  const RESTRICTED = 'Code contains restricted operations (file system access, network calls, or system commands are not allowed)';

  if (language === 'javascript') {
    for (const pattern of jsLiteralPatterns) {
      if (pattern.test(sourceCode)) return RESTRICTED;
    }
    const stripped = stripNonCode(sourceCode);
    for (const pattern of jsStrippedPatterns) {
      if (pattern.test(stripped)) return RESTRICTED;
    }
    return null;
  }

  const patterns = DANGEROUS_PATTERNS[language] || [];
  for (const pattern of patterns) {
    if (pattern.test(sourceCode)) {
      return RESTRICTED;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Local child_process fallback (dev only — not sandboxed beyond the regex gate)
// ---------------------------------------------------------------------------

const cleanup = (files) => {
  files.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
};

const cleanupDir = (dir) => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

function executeLocal(language, sourceCode, stdin = '') {
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
          command = process.platform === 'win32' ? 'python' : 'python3';
          args = [filePath];
          break;
        }
        case 'cpp': {
          filePath = path.join(tmpDir, `${id}.cpp`);
          const outPath = path.join(tmpDir, `${id}.exe`);
          fs.writeFileSync(filePath, sourceCode);
          cleanupFiles.push(filePath, outPath);
          // execFile (no shell) — no risk of compiler args being shell-interpolated.
          execFile('g++', [filePath, '-o', outPath], { timeout: 10000 }, (compErr, compStdout, compStderr) => {
            if (compErr) { cleanup(cleanupFiles); return resolve({ stdout: '', stderr: compStderr || compStdout || compErr.message, exitCode: 1 }); }
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
          execFile('gcc', [filePath, '-o', outPathC], { timeout: 10000 }, (compErr, compStdout, compStderr) => {
            if (compErr) { cleanup(cleanupFiles); return resolve({ stdout: '', stderr: compStderr || compStdout || compErr.message, exitCode: 1 }); }
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
          execFile('javac', [filePath], { timeout: 15000 }, (compErr, compStdout, compStderr) => {
            if (compErr) { cleanupDir(javaDir); return resolve({ stdout: '', stderr: compStderr || compStdout || compErr.message, exitCode: 1 }); }
            const child = execFile('java', ['-cp', javaDir, 'Main'], { timeout: 5000 }, (err, stdout, stderr) => {
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
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run code in the sandbox (Judge0 → local fallback in dev).
 *
 * @param {object} p
 * @param {string} p.language   'javascript'|'python'|'java'|'cpp'|'c'
 * @param {string} p.code
 * @param {string} [p.stdin]
 * @param {number} [p.maxBytes]  code size cap (bytes); defaults to 50KB (route cap)
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
async function runSandboxed({ language, code, stdin = '', maxBytes = MAX_CODE_LENGTH }) {
  const validationError = validateCode(language, code, maxBytes);
  if (validationError) {
    return { stdout: '', stderr: validationError, exitCode: 1 };
  }

  const languageId = LANG_MAP[language];
  if (!languageId) {
    return { stdout: '', stderr: `Language "${language}" not supported`, exitCode: 1 };
  }

  // Try Judge0 first.
  try {
    const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: code, language_id: languageId, stdin: stdin || '' }),
      signal: AbortSignal.timeout(EXEC_TIMEOUT),
    });
    const result = await response.json();
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || result.compile_output || '',
      exitCode: result.status && result.status.id === 3 ? 0 : 1,
    };
  } catch (err) {
    // A timed-out run is the USER's fault (infinite loop, slow algorithm) — it
    // must NOT be retried locally; that would just hang again unsandboxed.
    // AbortSignal.timeout throws TimeoutError on Node 18+, AbortError on abort.
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return {
        stdout: '',
        stderr: 'Execution timed out (10s limit).',
        exitCode: 1,
      };
    }
    if (config.isProduction()) {
      return {
        stdout: '',
        stderr: 'Code execution service is temporarily unavailable. Please try again later.',
        exitCode: 1,
      };
    }
    const local = await executeLocal(language, code, stdin);
    return { ...local, stdout: sanitizeOutput(local.stdout), stderr: sanitizeOutput(local.stderr) };
  }
}

module.exports = { runSandboxed, validateCode, normalizeStdin, DANGEROUS_PATTERNS, LANG_MAP, MAX_CODE_LENGTH };
