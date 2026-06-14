/**
 * Shared Groq client + model routing (plan Phase 1, B1).
 *
 * The product's value is the QUALITY of interview feedback, but every call used
 * the cheapest model (`llama-3.1-8b-instant`). Generation (MCQ filler, topics)
 * can stay cheap; graded feedback should use a stronger model. These helpers
 * centralize that split and — critically — fall back to the gen model if the
 * eval model errors (bad id / deprecation / rate limit), so routing to a better
 * grader is a STRICT improvement and never turns weak feedback into none.
 */

const Groq = require('groq-sdk');
const { config } = require('../config/env');

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const GEN_MODEL = () => config.groqGenModel();
const EVAL_MODEL = () => config.groqEvalModel();

/**
 * Run a completion on the strong eval model, falling back to the gen model on any
 * error from the eval model. Returns the completion AND the model that produced it
 * (so callers can record which grader was used).
 * @param {import('groq-sdk').Groq} groq
 * @param {object} params  chat.completions.create params WITHOUT `model`
 * @returns {Promise<{ completion: any, modelUsed: string }>}
 */
async function evalCompletion(groq, params) {
  const evalModel = EVAL_MODEL();
  try {
    const completion = await groq.chat.completions.create({ ...params, model: evalModel });
    return { completion, modelUsed: evalModel };
  } catch (err) {
    const genModel = GEN_MODEL();
    console.warn(`⚠️  Eval model "${evalModel}" failed (${err.message}); falling back to "${genModel}".`);
    const completion = await groq.chat.completions.create({ ...params, model: genModel });
    return { completion, modelUsed: genModel };
  }
}

module.exports = { getGroq, GEN_MODEL, EVAL_MODEL, evalCompletion };
