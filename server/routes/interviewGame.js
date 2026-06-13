const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const InterviewGame = require('../models/InterviewGame');
const { gradeMcqRound, sanitizeGame } = require('../utils/interviewGameScoring');
const { executeCode } = require('./codeExecution');
const Groq = require('groq-sdk');
const { emit: emitSignals } = require('../agent/services/signals');
const { upsertReviewItems } = require('../agent/services/reviewQueue');
const { resolveTemplate, difficultyFromReadiness } = require('../utils/gameTemplates');
const Company = require('../models/Company');
const PrepProfile = require('../models/PrepProfile');
const BehavioralAnswer = require('../models/BehavioralAnswer');
const router = express.Router();

// Normalize program output for comparison (trailing whitespace/newlines vary).
const normOut = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

// Round types graded server-side from the stored answer key (MCQ rounds).
const MCQ_ROUNDS = ['aptitude', 'technical1', 'technical2'];

// P6 spine: which readiness pillar each game round feeds.
const PILLAR_BY_ROUND = {
    aptitude: 'aptitude',
    technical1: 'cs_core',
    technical2: 'cs_core',
    coding: 'dsa',
    hr: 'communication',
    gd: 'communication',
};

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

// Generate MCQ questions via Groq
const generateMCQs = async (type, count) => {
  const groq = getGroq();
  const prompts = {
    aptitude: `Generate ${count} aptitude/quantitative reasoning MCQ questions for a placement test. Mix of: arithmetic, percentages, time-speed-distance, probability, number series, logical reasoning, verbal ability, data interpretation. Each question must be tricky but fair.`,
    technical: `Generate ${count} technical CS MCQ questions for a placement interview. Mix of: Data Structures, Algorithms, DBMS, Operating Systems, Computer Networks, OOP concepts, System Design basics. Questions should test deep understanding, not just definitions.`,
  };

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are a placement exam question generator. Return ONLY a JSON array. No extra text, no markdown.' },
      { role: 'user', content: `${prompts[type] || prompts.technical}

Return as JSON array:
[{"q":"question text","opts":["A","B","C","D"],"ans":"correct option (exact match)"}]

Return exactly ${count} questions.` }
    ],
    max_tokens: 4000,
    temperature: 0.8
  });

  try {
    const raw = completion.choices[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
};

// Generate HR questions via Groq
const generateHRQuestions = async (count) => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are an HR interview question generator. Return ONLY a JSON array of strings. No extra text.' },
      { role: 'user', content: `Generate ${count} HR/behavioral interview questions for a placement interview. Mix of: self-introduction, strengths/weaknesses, teamwork, leadership, failure handling, motivation, career goals, conflict resolution, pressure handling. Make them realistic and thought-provoking.

Return as JSON array of strings: ["question1","question2",...]` }
    ],
    max_tokens: 1500,
    temperature: 0.8
  });
  try {
    const raw = completion.choices[0]?.message?.content || '[]';
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch { return ["Tell me about yourself.", "What are your strengths?", "Where do you see yourself in 5 years?", "Why should we hire you?", "Describe a challenging situation."]; }
};

// P8: HR questions personalized to the target company/role, steered AWAY from
// competencies the candidate already has STAR stories for (so the round fills
// coverage gaps). Best-effort — callers fall back to the bank on empty/throw.
const generatePersonalizedHR = async (count, { company, role, coveredTags }) => {
  const groq = getGroq();
  const ctx = [
    company ? `target company: ${company}` : '',
    role ? `target role: ${role}` : '',
    coveredTags?.length ? `The candidate ALREADY has strong stories about: ${coveredTags.join(', ')}. Ask about OTHER competencies instead.` : '',
  ].filter(Boolean).join('\n');
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are an HR interview question generator. Return ONLY a JSON array of strings. No extra text.' },
      { role: 'user', content: `Generate ${count} HR/behavioral interview questions for a placement interview.
${ctx}
Cover a spread of competencies (teamwork, leadership, failure handling, conflict, motivation, career goals, pressure). Make them realistic and specific to the context above where relevant.

Return as JSON array of strings: ["question1","question2",...]` }
    ],
    max_tokens: 1500,
    temperature: 0.8,
  });
  try {
    const raw = completion.choices[0]?.message?.content || '[]';
    const arr = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return Array.isArray(arr) ? arr.filter((q) => typeof q === 'string' && q.trim()) : [];
  } catch { return []; }
};

// Generate GD topic via Groq
const generateGDTopic = async () => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'Return ONLY a single discussion topic as a plain string. No quotes, no JSON, no explanation.' },
      { role: 'user', content: 'Generate one thought-provoking group discussion topic for a placement interview. It should be relevant to technology, society, or current affairs. Make it debatable with multiple valid perspectives.' }
    ],
    max_tokens: 100,
    temperature: 0.9
  });
  return completion.choices[0]?.message?.content?.trim() || 'Is artificial intelligence a threat or an opportunity for the workforce?';
};

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

// Generate coding problems via Groq
const generateCodingProblems = async (count, difficulty = 'medium') => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
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

const QuestionBank = require('../models/QuestionBank');

// ─── ROUTES ───

// B3: difficulty-biased sampling. Returns `size` questions, preferring the chosen
// difficulty and topping up from other difficulties when the bank is too thin at
// that level — so a round never starves (aptitude needs 15 but a single difficulty
// band may hold fewer). The chosen difficulty therefore DOMINATES the round as far
// as the data allows, instead of difficulty being ignored entirely.
const VALID_DIFF = ['easy', 'medium', 'hard'];
const sampleByDifficulty = async (type, difficulty, size) => {
  const diff = VALID_DIFF.includes(difficulty) ? difficulty : 'medium';
  const primary = await QuestionBank.aggregate([
    { $match: { type, verified: true, difficulty: diff } },
    { $sample: { size } },
  ]);
  if (primary.length >= size) return primary;
  const have = primary.map((d) => d._id);
  const fill = await QuestionBank.aggregate([
    { $match: { type, verified: true, _id: { $nin: have } } },
    { $sample: { size: size - primary.length } },
  ]);
  return [...primary, ...fill];
};

// P8: category-weighted sampling for targeted games. Biases toward a template's
// `categoryWeights` AND the chosen difficulty, topping up across categories /
// difficulties so a round never starves (the bank is thin per category/difficulty
// — see the B3 lesson). Falls back to plain sampleByDifficulty when no weights.
const sampleWeighted = async (type, roundCfg, size) => {
  const difficulty = VALID_DIFF.includes(roundCfg?.difficulty) ? roundCfg.difficulty : 'medium';
  const wEntries = Object.entries(roundCfg?.categoryWeights || {}).filter(([, w]) => Number(w) > 0);
  if (!wEntries.length) return sampleByDifficulty(type, difficulty, size);

  const totalW = wEntries.reduce((a, [, w]) => a + Number(w), 0);
  const picked = [];
  const seen = new Set();
  const nin = () => picked.map((d) => d._id);
  const take = (docs) => { for (const d of docs) { const k = String(d._id); if (!seen.has(k)) { seen.add(k); picked.push(d); } } };

  for (const [category, w] of wEntries) {
    if (picked.length >= size) break;
    const target = Math.max(1, Math.round((size * Number(w)) / totalW));
    let want = Math.min(target, size - picked.length);
    if (want > 0) take(await QuestionBank.aggregate([{ $match: { type, verified: true, category, difficulty, _id: { $nin: nin() } } }, { $sample: { size: want } }]));
    want = Math.min(target, size - picked.length);
    if (want > 0) take(await QuestionBank.aggregate([{ $match: { type, verified: true, category, _id: { $nin: nin() } } }, { $sample: { size: want } }]));
  }
  // Overall top-up to `size`: chosen difficulty first, then any.
  if (picked.length < size) take(await QuestionBank.aggregate([{ $match: { type, verified: true, difficulty, _id: { $nin: nin() } } }, { $sample: { size: size - picked.length } }]));
  if (picked.length < size) take(await QuestionBank.aggregate([{ $match: { type, verified: true, _id: { $nin: nin() } } }, { $sample: { size: size - picked.length } }]));
  return picked.slice(0, size);
};

// Load the targeting context for a game so /questions can pick a template. Returns
// a resolved template (role family, per-round counts, categoryWeights, difficulty).
const templateForGame = async (gameId, userId) => {
  if (!gameId) return null;
  const game = await InterviewGame.findById(gameId);
  if (!game || !game.user.equals(userId)) return null;
  return {
    game,
    template: resolveTemplate({ companyName: game.companyName, role: game.targetRole, difficulty: game.difficulty }),
  };
};

// GET questions for a round — curated bank, composed by the game's company/role
// template (P8); AI fallback for GD and shortfalls. Round TYPES are unchanged;
// the template only tunes per-round count / category mix / difficulty.
router.get('/questions/:round', protect, aiLimiter, async (req, res) => {
  const round = req.params.round;
  try {
    // Targeting context: the game's company/role/difficulty → a round template.
    // Falls back to a neutral template seeded by the client's difficulty hint.
    const ctx = await templateForGame(req.query.gameId, req.user._id);
    const game = ctx?.game || null;
    const template = ctx?.template || resolveTemplate({ difficulty: req.query.difficulty });
    const rcfg = (key) => template.rounds[key] || {};

    let questions = [];
    switch (round) {
      case 'aptitude': {
        const cfg = rcfg('aptitude');
        const size = cfg.count || 15;
        const docs = await sampleWeighted('aptitude', cfg, size);
        questions = docs.map((q, i) => ({ id: `apt_${i}`, q: q.q, opts: q.opts, ans: q.ans, explanation: q.explanation, bankId: String(q._id), category: q.category, difficulty: q.difficulty }));
        // AI fallback if bank is empty
        if (questions.length < 5) {
          const mcqs = await generateMCQs('aptitude', size);
          questions = mcqs.map((q, i) => ({ id: `apt_${i}`, ...q }));
        }
        break;
      }
      case 'technical1':
      case 'technical2': {
        const cfg = rcfg(round);
        const size = cfg.count || 10;
        const docs = await sampleWeighted('technical', cfg, size);
        questions = docs.map((q, i) => ({ id: `tech_${i}`, q: q.q, opts: q.opts, ans: q.ans, explanation: q.explanation, bankId: String(q._id), category: q.category, difficulty: q.difficulty }));
        if (questions.length < 5) {
          const mcqs = await generateMCQs('technical', size);
          questions = mcqs.map((q, i) => ({ id: `tech_${i}`, ...q }));
        }
        break;
      }
      case 'hr': {
        const cfg = rcfg('hr');
        const size = cfg.count || 10;
        // P8: personalize HR for targeted games (company/role + STAR-gap steering).
        if (game && (game.companyName || game.targetRole)) {
          let coveredTags = [];
          try { coveredTags = await BehavioralAnswer.distinct('tags', { user: req.user._id }); } catch { /* best-effort */ }
          try {
            const hrQs = await generatePersonalizedHR(size, { company: game.companyName, role: game.targetRole, coveredTags: (coveredTags || []).filter(Boolean).slice(0, 12) });
            if (hrQs.length >= 3) questions = hrQs.map((q, i) => ({ id: `hr_${i}`, q, type: 'open' }));
          } catch { /* fall through to bank */ }
        }
        if (!questions.length) {
          const docs = await QuestionBank.aggregate([{ $match: { type: 'hr', verified: true } }, { $sample: { size } }]);
          questions = docs.map((q, i) => ({ id: `hr_${i}`, q: q.q, type: 'open' }));
          if (questions.length < 5) {
            const hrQs = await generateHRQuestions(size);
            questions = hrQs.map((q, i) => ({ id: `hr_${i}`, q, type: 'open' }));
          }
        }
        break;
      }
      case 'gd': {
        // GD topics are always AI-generated for freshness
        const topic = await generateGDTopic();
        questions = [{ id: 'gd_0', topic }];
        break;
      }
      case 'coding': {
        const cfg = rcfg('coding');
        const size = cfg.count || 2;
        const docs = await sampleByDifficulty('coding', cfg.difficulty, size);
        questions = docs.map(p => ({
          id: p._id.toString(),
          title: p.title,
          difficulty: p.difficulty,
          description: p.description,
          examples: p.examples,
          testCases: p.testCases,
          boilerplate: p.boilerplate,
        }));
        if (questions.length < 1) {
          // AI fallback: verify the generated test cases against the model's own
          // reference solution before they can grade anyone (see validateCodingProblems).
          const generated = await generateCodingProblems(size, VALID_DIFF.includes(cfg.difficulty) ? cfg.difficulty : 'medium');
          let problems = await validateCodingProblems(generated);
          // If validation discarded everything (e.g. the reference solution can't
          // run), fall back to the hand-verified problem so the round is never empty.
          if (problems.length < 1) problems = [FALLBACK_CODING_PROBLEM];
          questions = problems.map(p => ({
            id: p.id, title: p.title, difficulty: p.difficulty,
            description: p.description, examples: p.examples,
            testCases: p.testCases, boilerplate: p.boilerplate,
          }));
        }
        break;
      }
      default:
        return res.status(400).json({ success: false, message: 'Invalid round' });
    }

    // For MCQ rounds, persist the answer key + P8 review snapshot (bankId/q/
    // explanation/category/difficulty) on the game (server-only), then STRIP the
    // internal fields from the client response.
    if (MCQ_ROUNDS.includes(round)) {
      if (game) {
        const gameRound = game.rounds.find(r => r.type === round);
        if (gameRound) {
          gameRound.servedQuestions = questions.map(q => ({
            questionId: q.id, ans: q.ans, bankId: q.bankId,
            q: q.q, explanation: q.explanation, category: q.category, difficulty: q.difficulty,
          }));
          await game.save();
        }
      }
      // Never leak the answer key, explanations or internal ids to the client.
      questions = questions.map(({ ans, explanation, bankId, category, difficulty, ...rest }) => rest);
    } else if (round === 'coding' && game) {
      // Persist the coding test cases on the game so submit-round can grade the
      // user's code server-side (authoritative). Client contract is unchanged.
      const gameRound = game.rounds.find((r) => r.type === 'coding');
      if (gameRound) {
        // Store test cases for EVERY served problem so submit-round can grade all
        // of them (the UI has the user solve two). `testCases` (first problem) is
        // kept for backward compatibility with any in-flight game.
        const mapTests = (p) => (p?.testCases || []).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput || t.output }));
        gameRound.servedCoding = {
          problems: questions.map((p) => ({ problemId: String(p.id), testCases: mapTests(p) })),
          testCases: mapTests(questions[0]),
        };
        await game.save();
      }
    }

    res.json({ success: true, questions });
  } catch (err) {
    console.error('Question fetch error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load questions: ' + err.message });
  }
});

// START a new game. P8: accepts { companyFocus?, company?, role?, difficulty? }.
// Targeting defaults from the user's PrepProfile; difficulty seeds from readiness
// when the client doesn't pick one (user-overridable).
router.post('/start', protect, async (req, res) => {
  try {
    const profile = await PrepProfile.findOne({ user: req.user._id }).lean().catch(() => null);

    // Resolve the focus company: explicit id → lookup; else PrepProfile's top target.
    let companyFocus = req.body.companyFocus || undefined;
    let companyName = typeof req.body.company === 'string' ? req.body.company.trim() : '';
    if (companyFocus) {
      const c = await Company.findById(companyFocus).select('name').lean().catch(() => null);
      if (c) companyName = c.name;
    } else if (!companyName && profile?.targetCompanies?.length) {
      const top = profile.targetCompanies[0];
      companyName = top.name || '';
      companyFocus = top.company || undefined;
    }

    const targetRole = (typeof req.body.role === 'string' && req.body.role.trim())
      || profile?.targetRole || '';

    // Difficulty: explicit choice wins; otherwise seed from overall readiness.
    const difficulty = ['easy', 'medium', 'hard'].includes(req.body.difficulty)
      ? req.body.difficulty
      : difficultyFromReadiness(profile?.readiness?.overall);

    const game = await InterviewGame.create({
      user: req.user._id,
      difficulty,
      companyFocus,
      companyName: companyName.slice(0, 100),
      targetRole: String(targetRole).slice(0, 100),
      rounds: [
        { type: 'aptitude', maxScore: 100 },
        { type: 'technical1', maxScore: 100 },
        { type: 'coding', maxScore: 100 },
        { type: 'gd', maxScore: 100 },
        { type: 'technical2', maxScore: 100 },
        { type: 'hr', maxScore: 100 }
      ]
    });
    res.status(201).json({ success: true, game: sanitizeGame(game) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// SUBMIT a round
router.post('/submit-round', protect, async (req, res) => {
  try {
    const { gameId, roundIndex, answers } = req.body;
    const game = await InterviewGame.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    // Ownership: a user may only submit rounds to their own game.
    if (!game.user.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this game' });
    }

    const round = game.rounds[roundIndex];
    if (!round) return res.status(400).json({ success: false, message: 'Invalid round' });

    let score = 0;
    let reviewItemsAdded = 0;
    const roundType = round.type;

    if (MCQ_ROUNDS.includes(roundType)) {
      // SERVER-AUTHORITATIVE: grade every MCQ round (aptitude, technical1,
      // technical2) against the stored answer key from /questions.
      // The client-supplied aiScore / isCorrect flags are ignored entirely.
      const result = gradeMcqRound(round.servedQuestions, answers);
      score = result.score;
      round.answers = result.gradedAnswers;

      // P8: turn wrong / skipped questions into company-tagged review items. The
      // sourceKey is the QuestionBank `bankId` (NOT the positional questionId), so
      // the same wrong question dedups correctly across games. AI-generated
      // fallback MCQs have no bankId and are skipped (best-effort, never throws).
      try {
        const gradedById = new Map((result.gradedAnswers || []).map((a) => [String(a.questionId), a]));
        const candidates = (round.servedQuestions || [])
          .filter((sq) => sq.bankId && sq.q)
          .filter((sq) => {
            const g = gradedById.get(String(sq.questionId));
            return !g || g.isCorrect === false; // wrong or unanswered
          })
          .map((sq) => ({
            kind: 'mcq', sourceKey: sq.bankId, refId: sq.bankId,
            prompt: sq.q, answer: sq.ans, explanation: sq.explanation,
            category: sq.category, difficulty: sq.difficulty,
            company: game.companyName || '',
          }));
        reviewItemsAdded = await upsertReviewItems(req.user._id, candidates);
      } catch (_) { /* review bookkeeping is best-effort */ }
    } else if (roundType === 'coding' && round.servedCoding?.problems?.length) {
      // SERVER-AUTHORITATIVE coding grade across ALL served problems (the UI has
      // the user solve two). The per-problem code comes from `answers`
      // [{ problemId, language, code }]; the client-supplied aiScore is ignored.
      // Each problem scores 0..100 on its own hidden tests; the round is their mean
      // — matching what the UI displays so the shown score equals the stored score.
      const problems = round.servedCoding.problems;
      const byId = new Map();
      if (Array.isArray(answers)) {
        for (const a of answers) if (a && a.problemId != null) byId.set(String(a.problemId), a);
      }
      const parts = [];
      let pctSum = 0;
      for (let i = 0; i < problems.length; i++) {
        const prob = problems[i];
        const submission = byId.get(String(prob.problemId));
        const tests = prob.testCases || [];
        const code = submission?.code || (String(prob.problemId) === String(answers?.[0]?.problemId) ? req.body.code : '');
        if (!code || !tests.length) { parts.push(`P${i + 1}: 0/${tests.length}`); continue; }
        const language = String(submission?.language || req.body.language || 'python');
        let passed = 0;
        for (const tc of tests) {
          try {
            const out = await executeCode(language, code, tc.input || '');
            if (out && out.exitCode === 0 && normOut(out.stdout) === normOut(tc.expectedOutput)) passed += 1;
          } catch (_) { /* a failing/erroring test simply doesn't count */ }
        }
        pctSum += tests.length ? (passed / tests.length) * 100 : 0;
        parts.push(`P${i + 1}: ${passed}/${tests.length}`);
      }
      score = Math.round(pctSum / problems.length);
      round.feedback = `Passed hidden tests — ${parts.join(' · ')}.`;
    } else if (roundType === 'coding' && req.body.code && round.servedCoding?.testCases?.length) {
      // LEGACY single-problem path for games started before multi-problem grading.
      const tests = round.servedCoding.testCases;
      const language = String(req.body.language || 'python');
      let passed = 0;
      for (const tc of tests) {
        try {
          const out = await executeCode(language, req.body.code, tc.input || '');
          if (out && out.exitCode === 0 && normOut(out.output) === normOut(tc.expectedOutput)) passed += 1;
        } catch (_) { /* a failing/erroring test simply doesn't count */ }
      }
      score = Math.round((passed / tests.length) * 100);
      round.feedback = `Passed ${passed}/${tests.length} hidden test cases.`;
    } else {
      // GD / HR / live AI interview (and coding when no code/tests are available):
      // still scored from a client/AI-supplied value — clamp defensively to 0..100.
      const claimed = Number(req.body.aiScore);
      score = Number.isFinite(claimed) ? claimed : 0;
      if (Array.isArray(answers)) round.answers = answers;
    }

    round.score = Math.max(0, Math.min(score, 100));
    round.status = 'completed';
    round.completedAt = new Date();
    // P6 spine: report this round as skill evidence (best-effort, never throws).
    await emitSignals(req.user._id, [{
        pillar: PILLAR_BY_ROUND[roundType] || 'cs_core',
        skill: roundType,
        score: round.score / 100,
        source: 'interview_game',
        sourceId: game._id,
    }]);
    // Keep server-generated coding feedback; otherwise take the client's text.
    if (!round.feedback) round.feedback = typeof req.body.feedback === 'string' ? req.body.feedback : '';

    game.currentRound = roundIndex + 1;
    game.totalScore = game.rounds.reduce((sum, r) => sum + r.score, 0);

    if (roundIndex >= game.rounds.length - 1) {
      game.status = 'completed';
      game.completedAt = new Date();
    }
    await game.save();
    res.json({ success: true, game: sanitizeGame(game), roundScore: round.score, reviewItemsAdded });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET user's game history
router.get('/history', protect, async (req, res) => {
  try {
    const games = await InterviewGame.find({ user: req.user._id }).sort({ startedAt: -1 }).limit(20);
    res.json({ success: true, games: games.map(sanitizeGame) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET specific game
router.get('/:id', protect, async (req, res) => {
  try {
    const game = await InterviewGame.findById(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    // Ownership: only the owner may view a game (answer keys live on it).
    if (!game.user.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this game' });
    }
    res.json({ success: true, game: sanitizeGame(game) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET /:id/report — post-game summary: per-round breakdown vs. pillar, weakest
// rounds, company/role context, and how many review items are now due.
router.get('/:id/report', protect, async (req, res) => {
  try {
    const game = await InterviewGame.findById(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (!game.user.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized for this game' });

    const ROUND_LABEL = { aptitude: 'Aptitude', technical1: 'Technical I', technical2: 'Technical II', coding: 'Coding', gd: 'Group Discussion', hr: 'HR' };
    const rounds = game.rounds.map((r) => ({
      type: r.type, label: ROUND_LABEL[r.type] || r.type,
      pillar: PILLAR_BY_ROUND[r.type] || 'cs_core',
      score: r.score, status: r.status,
    }));
    const completed = rounds.filter((r) => r.status === 'completed');
    const weakest = [...completed].sort((a, b) => a.score - b.score).slice(0, 2);

    let company = null;
    if (game.companyFocus) {
      company = await Company.findById(game.companyFocus).select('name interviewPattern difficultyLevel').lean().catch(() => null);
    }
    if (!company && game.companyName) company = { name: game.companyName };

    const ReviewItem = require('../models/ReviewItem');
    const dueReviewCount = await ReviewItem.countDocuments({ user: req.user._id, mastered: false, dueAt: { $lte: new Date() } }).catch(() => 0);

    res.json({
      success: true,
      report: {
        gameId: game._id, status: game.status,
        difficulty: game.difficulty, targetRole: game.targetRole,
        company, rounds, weakest,
        totalScore: game.totalScore, maxTotalScore: game.maxTotalScore,
        dueReviewCount,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET leaderboard — top performers across all games
router.get('/leaderboard/top', protect, async (req, res) => {
  try {
    const leaderboard = await InterviewGame.aggregate([
      { $match: { status: 'completed' } },
      { $group: {
        _id: '$user',
        bestScore: { $max: '$totalScore' },
        maxPossible: { $first: '$maxTotalScore' },
        gamesPlayed: { $sum: 1 },
        avgScore: { $avg: '$totalScore' },
        lastPlayed: { $max: '$completedAt' }
      }},
      { $sort: { bestScore: -1 } },
      { $limit: 50 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: {
        _id: 1,
        name: '$userInfo.name',
        bestScore: 1,
        maxPossible: 1,
        bestPercent: { $round: [{ $multiply: [{ $divide: ['$bestScore', { $ifNull: ['$maxPossible', 600] }] }, 100] }, 1] },
        gamesPlayed: 1,
        avgScore: { $round: ['$avgScore', 0] },
        lastPlayed: 1
      }}
    ]);
    res.json({ success: true, leaderboard });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
// Exposed for the P8 verify script (seeds/verifyTargetedGame.js) to exercise the
// real sampling path without spinning up HTTP.
module.exports.sampleWeighted = sampleWeighted;
module.exports.sampleByDifficulty = sampleByDifficulty;
