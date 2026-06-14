/**
 * Shared coding-problem generation + verification (extracted from
 * routes/interviewGame.js so the Interview Game AND the Phase-2 learning-path
 * final test reuse one implementation — and one security guarantee: AI test
 * cases are NEVER used to grade anyone until verified against the model's own
 * reference solution).
 *
 * Behavior is identical to the previous in-route definitions; the game route now
 * imports these instead of defining them. Keep the verification contract intact.
 */
const { getGroq, GEN_MODEL } = require('./aiModels');
const { executeCode } = require('../routes/codeExecution');

// Normalize program output for comparison (trailing whitespace/newlines vary).
const normOut = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

// Hand-verified safe coding problem used when AI generation fails or when AI test
// cases can't be validated. Has no `referenceSolution`, so it passes straight
// through validateCodingProblems and its known-correct test cases grade fairly.
const FALLBACK_CODING_PROBLEM = {
  id: 'find_max',
  title: 'Find Maximum Element',
  difficulty: 'Easy',
  description: 'Given an array of n integers, find and print the maximum element.\n\nInput: First line n, second line n space-separated integers.\nOutput: The maximum element.',
  examples: [{ input: '5\n3 1 4 1 5', output: '5', explanation: 'Maximum of [3,1,4,1,5] is 5' }],
  testCases: [
    { input: '5\n3 1 4 1 5', expectedOutput: '5' },
    { input: '1\n42', expectedOutput: '42' },
    { input: '3\n-1 -5 -2', expectedOutput: '-1' },
    { input: '4\n10 20 30 40', expectedOutput: '40' },
    { input: '6\n7 7 7 7 7 7', expectedOutput: '7' },
  ],
  boilerplate: {
    javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\nconsole.log(Math.max(...arr));`,
    python: `n = int(input())\narr = list(map(int, input().split()))\n# Your code here\nprint(max(arr))`,
    cpp: `#include <iostream>\n#include <algorithm>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin >> arr[i];\n    // Your code here\n    cout << *max_element(arr, arr+n) << endl;\n    return 0;\n}`,
    java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int max = Integer.MIN_VALUE;\n        for(int i=0;i<n;i++) max = Math.max(max, sc.nextInt());\n        System.out.println(max);\n    }\n}`,
    c: `#include <stdio.h>\n#include <limits.h>\nint main() {\n    int n; scanf("%d", &n);\n    int max = INT_MIN;\n    for(int i=0;i<n;i++) { int x; scanf("%d", &x); if(x>max) max=x; }\n    printf("%d\\n", max);\n    return 0;\n}`
  }
};

// Generate coding problems via Groq.
const generateCodingProblems = async (count, difficulty = 'medium') => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: GEN_MODEL(),
    messages: [
      { role: 'system', content: 'You are a competitive programming problem setter. Return ONLY valid JSON. No markdown, no extra text.' },
      { role: 'user', content: `Generate ${count} coding problems for a placement interview coding round (${difficulty} difficulty). Each problem should have:
- Clear problem statement with input/output format
- 2 examples with explanations
- 5 test cases with input and expected output
- Boilerplate code for JavaScript, Python, C++, Java, C

The problems should test: arrays, strings, searching, sorting, dynamic programming, or recursion.

Input format: first line = n (size), second line = space-separated values, third line = target/parameter if needed.
Output format: single line output.

Also include a WORKING Python 3 reference solution (reads stdin, prints stdout)
that actually solves the problem — it is used to verify the test cases.

Return as JSON array:
[{
  "id": "snake_case_id",
  "title": "Problem Title",
  "difficulty": "Easy|Medium|Hard",
  "description": "Full problem description with input/output format",
  "examples": [{"input": "...", "output": "...", "explanation": "..."}],
  "testCases": [{"input": "stdin input", "expectedOutput": "expected stdout"}],
  "referenceSolution": "complete runnable Python 3 program that reads the input and prints the correct output",
  "boilerplate": {
    "javascript": "code with // Your code here placeholder",
    "python": "code with # Your code here placeholder",
    "cpp": "code with // Your code here placeholder",
    "java": "code with // Your code here placeholder",
    "c": "code with // Your code here placeholder"
  }
}]` }
    ],
    max_tokens: 6000,
    temperature: 0.7
  });

  try {
    const raw = completion.choices[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Parse failure → one hand-verified problem so the round is never empty.
    return [FALLBACK_CODING_PROBLEM];
  }
};

// Verify AI-generated coding test cases before they're ever used to grade a user.
// The model's claimed `expectedOutput` can be wrong, so we run its OWN Python
// reference solution and trust the reference's actual output as the expected
// output. Cases the reference can't produce cleanly are dropped; a problem left
// with too few verified cases is discarded entirely — better to serve no AI
// problem than to grade someone against a hallucinated answer key. Problems with
// no referenceSolution (the hand-curated fallback / verified bank) pass through.
const validateCodingProblems = async (problems) => {
  const out = [];
  for (const p of problems || []) {
    const ref = p?.referenceSolution;
    if (!ref || typeof ref !== 'string') { out.push(p); continue; }
    const verified = [];
    for (const tc of p.testCases || []) {
      try {
        const r = await executeCode('python', ref, tc.input || '');
        if (r && r.exitCode === 0) {
          const actual = normOut(r.stdout);
          if (actual !== '') verified.push({ input: tc.input, expectedOutput: actual });
        }
      } catch (_) { /* unrunnable case is dropped */ }
    }
    if (verified.length >= 3) {
      // eslint-disable-next-line no-unused-vars
      const { referenceSolution, ...rest } = p;
      out.push({ ...rest, testCases: verified });
    }
  }
  return out;
};

module.exports = { normOut, FALLBACK_CODING_PROBLEM, generateCodingProblems, validateCodingProblems };
