/**
 * Server-authoritative scoring for Interview Game MCQ rounds (Phase 1 security).
 *
 * The previous implementation sent correct answers to the client and trusted a
 * client-supplied `aiScore` — so anyone could score 100. These pure helpers let
 * the server grade from its own stored answer key (`servedQuestions`) and strip
 * that key from anything returned to the client.
 *
 * Kept dependency-free and side-effect-free so they can be unit-tested without a DB.
 */

const norm = (v) => String(v == null ? '' : v).trim();

/**
 * Grade an MCQ round against the server's stored answer key.
 * @param {Array<{questionId:string, ans:string}>} servedQuestions  what the server served (with answers)
 * @param {Array<{questionId:string, selectedAnswer:string}>} answers  what the client submitted
 * @returns {{ score:number, correct:number, total:number, gradedAnswers:Array }}
 *   score is 0..100 over the number of questions SERVED (blanks count against you).
 */
function gradeMcqRound(servedQuestions, answers) {
  const served = Array.isArray(servedQuestions) ? servedQuestions : [];
  const submitted = Array.isArray(answers) ? answers : [];

  const keyById = new Map(served.map((s) => [norm(s.questionId), norm(s.ans)]));

  let correct = 0;
  const gradedAnswers = submitted.map((a) => {
    const key = keyById.get(norm(a.questionId));
    const isCorrect = key !== undefined && key !== '' && norm(a.selectedAnswer) === key;
    if (isCorrect) correct += 1;
    return { questionId: a.questionId, selectedAnswer: a.selectedAnswer, isCorrect };
  });

  // Denominator is questions served, not answered — leaving blanks lowers the score.
  const total = served.length || submitted.length || 0;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return { score, correct, total, gradedAnswers };
}

/**
 * Return a plain game object safe to send to the client: strips `servedQuestions`
 * (the answer key) from every round. Accepts a Mongoose doc or a plain object.
 */
function sanitizeGame(game) {
  if (!game) return game;
  const obj = typeof game.toObject === 'function' ? game.toObject() : { ...game };
  if (Array.isArray(obj.rounds)) {
    obj.rounds = obj.rounds.map((r) => {
      // eslint-disable-next-line no-unused-vars
      const { servedQuestions, ...rest } = r;
      return rest;
    });
  }
  return obj;
}

module.exports = { gradeMcqRound, sanitizeGame };
