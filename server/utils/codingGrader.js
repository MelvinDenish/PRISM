// Shared coding-practice grading engine.
//
// The same normalization + execution path is used to (a) VERIFY a problem at
// seed time by running its reference solution to produce trusted expected
// outputs (A7-safe — never hand-typed), and (b) GRADE a user submission at
// request time. Using one engine for both means the expected output a user is
// graded against was produced the exact same way it will be compared.

const { executeCode } = require('../routes/codeExecution');

// Tolerant equality: ignore CRLF, trailing whitespace per line, and trailing
// blank lines. Internal structure (line breaks, inter-token spacing) still matters.
const normalizeOutput = (s) =>
    (s || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.replace(/\s+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');

// Run a problem's Python reference solution against each declared test input and
// adopt the reference's ACTUAL stdout as the expected output. A case is kept only
// if the reference exits cleanly and produces non-empty output (or output is
// legitimately empty — we keep those too, marked). Returns verified test cases
// plus a flag. If the reference fails on every case, the problem is unverified
// and must not grade anyone.
const verifyProblem = async (problem) => {
    const ref = problem.referenceSolution || problem.reference;
    const inputs = problem.testInputs || (problem.testCases || []).map((t) => t.input);
    if (!ref || !inputs || !inputs.length) {
        return { testCases: [], verified: false, reason: 'missing reference or test inputs' };
    }

    const testCases = [];
    for (const input of inputs) {
        const r = await executeCode('python', ref, input ?? '');
        if (r.exitCode === 0) {
            testCases.push({ input, expectedOutput: normalizeOutput(r.stdout) });
        } else {
            return {
                testCases: [],
                verified: false,
                reason: `reference failed on input ${JSON.stringify(input)}: ${r.stderr?.slice(0, 200)}`,
            };
        }
    }
    return { testCases, verified: testCases.length === inputs.length };
};

// Grade a user submission against a problem's already-verified test cases.
// Server-authoritative: callers pass the problem loaded from the DB, never
// client-supplied test cases.
const gradeSubmission = async ({ testCases, language, code }) => {
    const results = [];
    let passed = 0;
    let runtimeError = false;

    for (const tc of testCases) {
        const r = await executeCode(language, code, tc.input || '');
        const actual = normalizeOutput(r.stdout);
        const expected = normalizeOutput(tc.expectedOutput);
        const ok = r.exitCode === 0 && actual === expected;
        if (ok) passed += 1;
        if (r.exitCode !== 0) runtimeError = true;
        results.push({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: r.stdout || '',
            error: r.exitCode !== 0 ? r.stderr || 'Runtime error' : null,
            passed: ok,
        });
    }

    const total = testCases.length;
    const allPassed = total > 0 && passed === total;
    const status = allPassed ? 'accepted' : runtimeError ? 'runtime_error' : 'wrong_answer';
    const score = total ? Math.round((passed / total) * 100) : 0;

    return { passed: allPassed, passedCount: passed, totalCount: total, results, score, status };
};

module.exports = { normalizeOutput, verifyProblem, gradeSubmission };
