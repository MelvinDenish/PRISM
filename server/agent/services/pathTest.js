/**
 * Learning-path final-test generator (Phase 2).
 *
 * Builds a test from the path's resource CONTENT (extracted text + topic):
 *   - coding-related topic → coding problems (reuse the shared, reference-verified
 *     codingProblems helpers — AI test cases are validated before they can grade).
 *   - otherwise → ~10 MCQs via the agent LLM (90% gate = miss at most one).
 *
 * Returns { format, questions (CLIENT-SAFE — no answers), servedKey (SERVER-ONLY
 * answer key) }. The route persists servedKey on the path and never serializes it.
 */
const llm = require('../llm');
const { config } = require('../../config/env');
const Resource = require('../../models/Resource');
const { extractText } = require('./resourceContent');
const { generateCodingProblems, validateCodingProblems, FALLBACK_CODING_PROBLEM } = require('../../utils/codingProblems');

const CODING_HINTS = /\b(dsa|data structures?|algorithms?|coding|programming|arrays?|strings?|stack|queue|heap|recursion|linked list|binary tree|trees?|graphs?|dynamic programming|dp|sorting|searching|greedy|bst)\b/i;

const MCQ_COUNT = 10;

function isCodingTopic(path) {
  const hay = [path.title, path.topic?.name, path.description].filter(Boolean).join(' ');
  return CODING_HINTS.test(hay);
}

function difficultyForLevel(level) {
  return level === 'advanced' ? 'hard' : level === 'intermediate' ? 'medium' : 'easy';
}

// Concatenate the extracted text of every step's resource (+ step titles), bounded.
async function gatherContent(path) {
  const ids = (path.steps || []).map((s) => s.resource).filter(Boolean);
  const resources = await Resource.find({ _id: { $in: ids } }).populate('topic', 'name');
  const byId = new Map(resources.map((r) => [String(r._id), r]));
  const chunks = [];
  for (const s of path.steps || []) {
    const r = s.resource && byId.get(String(s.resource));
    if (r) {
      const t = await extractText(r);
      if (t) chunks.push(`## ${s.title || r.title}\n${t}`);
    } else if (s.title) {
      chunks.push(`## ${s.title}\n${s.description || ''}`);
    }
  }
  return chunks.join('\n\n').slice(0, 16000);
}

// ── MCQ test from content ──
async function generateMcqTest(path) {
  if (!config.hasLLM()) { const e = new Error('AI is not configured for test generation.'); e.statusCode = 503; throw e; }
  const content = await gatherContent(path);
  const topicName = path.topic?.name || path.title || 'this topic';

  const message = await llm.chat({
    model: llm.GEN_MODEL(),
    temperature: 0.4,
    max_tokens: 3000,
    messages: [
      { role: 'system', content: 'You write placement-test MCQs. Return ONLY a JSON array — no markdown, no commentary.' },
      { role: 'user', content: `Create exactly ${MCQ_COUNT} multiple-choice questions that test understanding of "${topicName}", grounded in the study material below. Each question has 4 options and exactly one correct answer. Make them conceptually meaningful (not trivia), with plausible distractors.

STUDY MATERIAL:
${content || topicName}

Return as a JSON array:
[{"q":"question","opts":["A","B","C","D"],"ans":"the exact text of the correct option"}]` },
    ],
  });

  let parsed;
  try {
    const raw = message.content || '[]';
    parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch { parsed = []; }

  const questions = [];
  const servedKey = [];
  (Array.isArray(parsed) ? parsed : []).forEach((q, i) => {
    if (!q || typeof q.q !== 'string' || !Array.isArray(q.opts) || q.opts.length < 2) return;
    const id = `q${i}`;
    const opts = q.opts.map(String).slice(0, 6);
    // Only keep a question whose answer is actually one of its options.
    const ans = String(q.ans);
    if (!opts.includes(ans)) return;
    questions.push({ id, q: q.q, opts });
    servedKey.push({ id, ans });
  });

  if (questions.length < 4) { const e = new Error('Could not generate a valid test from this path. Add more resources and try again.'); e.statusCode = 422; throw e; }
  return { format: 'mcq', questions, servedKey };
}

// ── Coding test ──
async function generateCodingTest(path) {
  const difficulty = difficultyForLevel(path.level);
  let problems = [];
  if (config.hasGroq()) {
    try { problems = await validateCodingProblems(await generateCodingProblems(2, difficulty)); } catch { problems = []; }
  }
  if (!problems.length) problems = [FALLBACK_CODING_PROBLEM]; // hand-verified, always gradeable

  const questions = problems.map((p, i) => ({
    id: String(p.id || `c${i}`),
    title: p.title, difficulty: p.difficulty, description: p.description,
    examples: p.examples || [], boilerplate: p.boilerplate || {},
  }));
  const servedKey = problems.map((p, i) => ({
    id: String(p.id || `c${i}`),
    testCases: (p.testCases || []).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput || t.output })),
  }));
  return { format: 'coding', questions, servedKey };
}

/**
 * Generate the final test for a path. Throws { statusCode } for caller-facing errors.
 * @returns {Promise<{format, questions, servedKey}>}
 */
async function generatePathTest(path) {
  return isCodingTopic(path) ? generateCodingTest(path) : generateMcqTest(path);
}

module.exports = { generatePathTest, isCodingTopic, MCQ_COUNT };
