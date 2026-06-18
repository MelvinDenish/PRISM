/**
 * Self-consistency filter for AI-generated MCQs.
 *
 * A SECOND (stronger) model answers each question BLIND — no answer key — and we keep
 * only the questions where it AGREES with the generator's answer. Disagreement means the
 * question is ambiguous or the keyed answer is wrong, so it is dropped rather than served.
 * This is the "verify-then-ship" principle applied to test questions: cross-model
 * agreement is a cheap, real ground-truth signal (one extra BATCHED call for the whole
 * set, not one per question).
 *
 * Best-effort and safe: on any failure (verifier unavailable / bad JSON) it returns the
 * input unchanged, and it never drops more than half the set (a misbehaving verifier
 * can't nuke a whole test) — generation is never blocked.
 */
const llm = require('./../llm');

/**
 * @param {Array<{q:string,opts:string[],ans:string}>} questions  generator output
 * @param {{ tier?: 'fast'|'gen'|'strong'|'plan' }} [opts]  verifier model tier (default 'strong')
 * @returns {Promise<Array>} the consensus-agreed subset (or the input unchanged on failure)
 */
async function filterByConsensus(questions, { tier = 'strong' } = {}) {
  const items = (Array.isArray(questions) ? questions : []).filter(
    (q) => q && typeof q.q === 'string' && Array.isArray(q.opts) && q.opts.length >= 2 && q.ans != null,
  );
  if (items.length < 2) return questions; // nothing meaningful to cross-check

  const blind = items.map((q, i) => ({ id: i, q: q.q, opts: q.opts.map(String) }));

  let parsed;
  try {
    const message = await llm.chatWithFailover({
      pool: llm.fastPool(tier),
      temperature: 0,            // deterministic answering
      max_tokens: 1200,
      messages: [
        { role: 'system', content: 'You are an exam answer-key checker. For each question, choose the single best correct option. Return ONLY a JSON array [{"id":<number>,"ans":"<exact option text>"}] — no markdown, no commentary.' },
        { role: 'user', content: `Questions:\n${JSON.stringify(blind)}` },
      ],
    });
    const raw = (message.content || '[]').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    return questions; // verifier unavailable / unparseable → don't block, serve as-is
  }

  const verdict = new Map();
  (Array.isArray(parsed) ? parsed : []).forEach((v) => {
    if (v && typeof v.id === 'number') verdict.set(v.id, String(v.ans == null ? '' : v.ans).trim().toLowerCase());
  });

  const agreed = items.filter((q, i) => {
    const v = verdict.get(i);
    if (v === undefined) return true; // verifier skipped it → keep (don't over-drop)
    return v === String(q.ans).trim().toLowerCase();
  });

  // Safety: never let a misbehaving verifier gut the test. If consensus would drop more
  // than half, distrust the verifier and serve the original set.
  return agreed.length >= Math.max(2, Math.ceil(items.length * 0.5)) ? agreed : questions;
}

module.exports = { filterByConsensus };
