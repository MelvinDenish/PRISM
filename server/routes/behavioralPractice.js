const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { evalCompletion } = require('../utils/aiModels');
const QuestionBank = require('../models/QuestionBank');
const { emit: emitSignals } = require('../agent/services/signals');
const router = express.Router();

// Behavioral PRACTICE is the answer→AI-score loop, parallel to the STAR Bank
// (/api/behavioral, which only stores the user's own drafts). A mentee picks an
// HR-style prompt, types an answer, and the model grades it on STAR structure,
// specificity, and relevance — feeding the `communication` readiness pillar.

const fail = (res, err) => res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });

// Curated fallback prompts when the HR bank is thin/empty (mirrors the bank's
// type:'hr' questions so the page always has something to practice).
const FALLBACK_PROMPTS = [
  'Tell me about a time you faced a conflict in a team and how you resolved it.',
  'Describe a time you failed at something. What did you learn?',
  'Tell me about a challenging project and your specific role in it.',
  'Describe a situation where you showed leadership.',
  'Tell me about a time you had to learn something quickly under pressure.',
  'Describe a time you disagreed with a decision. What did you do?',
  'Give an example of a goal you reached and how you achieved it.',
  'Tell me about a time you went above and beyond what was expected.',
];

// GET /questions — sample HR prompts from the bank (type:'hr'); fall back to the
// curated list so the page never starves.
router.get('/questions', protect, async (req, res) => {
  try {
    const size = Math.max(1, Math.min(Number(req.query.count) || 8, 20));
    const docs = await QuestionBank.aggregate([
      { $match: { type: 'hr', verified: true } },
      { $sample: { size } },
    ]).catch(() => []);
    let questions = docs
      .map((d) => (d.q || '').trim())
      .filter(Boolean);
    if (questions.length < 3) {
      // Top up from the fallback prompts (deduped) so there's always a spread.
      const seen = new Set(questions);
      for (const p of FALLBACK_PROMPTS) { if (!seen.has(p)) { seen.add(p); questions.push(p); } if (questions.length >= size) break; }
    }
    res.json({ success: true, questions: questions.slice(0, size) });
  } catch (err) { fail(res, err); }
});

// POST /evaluate — AI-grade one behavioral answer. Server-authoritative: the
// score is computed here (the client never supplies it). Emits a communication
// signal best-effort so practice feeds the prep spine.
router.post('/evaluate', protect, aiLimiter, async (req, res) => {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    const answer = typeof req.body.answer === 'string' ? req.body.answer.trim() : '';
    if (!question) return res.status(400).json({ success: false, message: 'Question is required' });
    if (answer.length < 20) {
      return res.status(400).json({ success: false, message: 'Write a fuller answer (at least a couple of sentences) before scoring.' });
    }

    const prompt = `You are an experienced placement HR interviewer grading a candidate's behavioral answer.

QUESTION: ${question.slice(0, 600)}

CANDIDATE ANSWER: ${answer.slice(0, 4000)}

Grade STRICTLY on the STAR framework (Situation, Task, Action, Result), specificity (concrete details, named technologies, quantified outcomes), and relevance to the question. Reward real ownership and measurable results; penalise vague generalities, missing STAR components, and answers that drift off-question.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "score": (0-100 integer),
  "star": { "situation": (0-25), "task": (0-25), "action": (0-25), "result": (0-25) },
  "strengths": ["short, specific points"],
  "improvements": ["short, actionable points"],
  "modelOutline": "A 3-4 sentence STAR outline showing how a strong answer to THIS question would be structured (an outline, not a fabricated story)."
}`;

    const { completion } = await evalCompletion({
      messages: [
        { role: 'system', content: 'You return only strict JSON. No markdown fences, no commentary.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 900,
      temperature: 0.3,
    });

    let evaluation;
    try {
      const raw = completion.choices[0]?.message?.content || '{}';
      evaluation = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      evaluation = { score: 60, strengths: [], improvements: ['Could not parse the model response — try again.'], modelOutline: '' };
    }

    // Clamp + shape defensively (the model is not trusted to stay in range/shape).
    const score = Math.max(0, Math.min(Math.round(Number(evaluation.score) || 0), 100));
    const out = {
      score,
      star: evaluation.star && typeof evaluation.star === 'object' ? evaluation.star : undefined,
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 8).map(String) : [],
      improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.slice(0, 8).map(String) : [],
      modelOutline: typeof evaluation.modelOutline === 'string' ? evaluation.modelOutline : '',
    };

    // P6 spine: feed the communication pillar (best-effort, never throws).
    await emitSignals(req.user._id, [{
      pillar: 'communication',
      skill: 'behavioral',
      score: score / 100,
      source: 'behavioral_practice',
    }]);

    res.json({ success: true, evaluation: out });
  } catch (err) { fail(res, err); }
});

module.exports = router;
