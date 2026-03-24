const express = require('express');
const { protect } = require('../middleware/auth');
const InterviewGame = require('../models/InterviewGame');
const Groq = require('groq-sdk');
const router = express.Router();

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
    model: 'llama-3.3-70b-versatile',
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
    model: 'llama-3.3-70b-versatile',
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

// Generate GD topic via Groq
const generateGDTopic = async () => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Return ONLY a single discussion topic as a plain string. No quotes, no JSON, no explanation.' },
      { role: 'user', content: 'Generate one thought-provoking group discussion topic for a placement interview. It should be relevant to technology, society, or current affairs. Make it debatable with multiple valid perspectives.' }
    ],
    max_tokens: 100,
    temperature: 0.9
  });
  return completion.choices[0]?.message?.content?.trim() || 'Is artificial intelligence a threat or an opportunity for the workforce?';
};

// Generate coding problems via Groq
const generateCodingProblems = async (count, difficulty = 'medium') => {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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

Return as JSON array:
[{
  "id": "snake_case_id",
  "title": "Problem Title",
  "difficulty": "Easy|Medium|Hard",
  "description": "Full problem description with input/output format",
  "examples": [{"input": "...", "output": "...", "explanation": "..."}],
  "testCases": [{"input": "stdin input", "expectedOutput": "expected stdout"}],
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
    // Fallback: return a simple problem
    return [{
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
    }];
  }
};

// ─── ROUTES ───

// GET questions for a round (generated dynamically via Groq)
router.get('/questions/:round', protect, async (req, res) => {
  const round = req.params.round;
  try {
    let questions = [];
    switch (round) {
      case 'aptitude': {
        const mcqs = await generateMCQs('aptitude', 15);
        questions = mcqs.map((q, i) => ({ id: `apt_${i}`, ...q }));
        break;
      }
      case 'technical1':
      case 'technical2': {
        const mcqs = await generateMCQs('technical', 10);
        questions = mcqs.map((q, i) => ({ id: `tech_${i}`, ...q }));
        break;
      }
      case 'hr': {
        const hrQs = await generateHRQuestions(10);
        questions = hrQs.map((q, i) => ({ id: `hr_${i}`, q, type: 'open' }));
        break;
      }
      case 'gd': {
        const topic = await generateGDTopic();
        questions = [{ id: 'gd_0', topic }];
        break;
      }
      case 'coding': {
        const problems = await generateCodingProblems(2, 'medium');
        questions = problems.map(p => ({
          id: p.id,
          title: p.title,
          difficulty: p.difficulty,
          description: p.description,
          examples: p.examples,
          testCases: p.testCases,
          boilerplate: p.boilerplate,
        }));
        break;
      }
      default:
        return res.status(400).json({ success: false, message: 'Invalid round' });
    }
    res.json({ success: true, questions });
  } catch (err) {
    console.error('Question generation error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate questions: ' + err.message });
  }
});

// START a new game
router.post('/start', protect, async (req, res) => {
  try {
    const game = await InterviewGame.create({
      user: req.user._id,
      difficulty: req.body.difficulty || 'medium',
      companyFocus: req.body.companyFocus,
      rounds: [
        { type: 'aptitude', maxScore: 100 },
        { type: 'technical1', maxScore: 100 },
        { type: 'coding', maxScore: 100 },
        { type: 'gd', maxScore: 100 },
        { type: 'technical2', maxScore: 100 },
        { type: 'hr', maxScore: 100 }
      ]
    });
    res.status(201).json({ success: true, game });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// SUBMIT a round — use Groq to evaluate MCQ answers
router.post('/submit-round', protect, async (req, res) => {
  try {
    const { gameId, roundIndex, answers } = req.body;
    const game = await InterviewGame.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    const round = game.rounds[roundIndex];
    if (!round) return res.status(400).json({ success: false, message: 'Invalid round' });

    let score = 0;
    const roundType = round.type;

    if (['aptitude', 'technical1', 'technical2'].includes(roundType)) {
      // For Groq-generated MCQs, we sent the correct answer with the question
      // Client-side matching: answers contain { questionId, question, selectedAnswer }
      // The correct answer was embedded in the question data
      // Score directly from aiScore sent by client
      score = req.body.aiScore || 0;

      // Or count correct from answers if provided with isCorrect
      if (!req.body.aiScore && answers?.length) {
        const correct = answers.filter(a => a.isCorrect).length;
        score = Math.round((correct / answers.length) * 100);
      }
    } else if (roundType === 'coding') {
      score = req.body.aiScore || answers.reduce((sum, a) => sum + (a.passed ? 50 : 0), 0);
    } else if (roundType === 'gd' || roundType === 'hr') {
      score = req.body.aiScore || 70;
    }

    round.score = Math.min(score, 100);
    round.status = 'completed';
    round.completedAt = new Date();
    round.feedback = req.body.feedback || '';

    game.currentRound = roundIndex + 1;
    game.totalScore = game.rounds.reduce((sum, r) => sum + r.score, 0);

    if (roundIndex >= game.rounds.length - 1) {
      game.status = 'completed';
      game.completedAt = new Date();
    }
    await game.save();
    res.json({ success: true, game, roundScore: round.score });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET user's game history
router.get('/history', protect, async (req, res) => {
  try {
    const games = await InterviewGame.find({ user: req.user._id }).sort({ startedAt: -1 }).limit(20);
    res.json({ success: true, games });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET specific game
router.get('/:id', protect, async (req, res) => {
  try {
    const game = await InterviewGame.findById(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    res.json({ success: true, game });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
