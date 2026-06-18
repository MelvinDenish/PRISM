/**
 * Shared model routing for the non-PII AI routes (interview, GD, game, coding).
 *
 * Was a thin groq-sdk wrapper; now routes through the provider-agnostic failover
 * client (agent/llm.js) so every caller fans across the free pool
 * (Cerebras → Groq → OpenRouter) and fails over on 429/5xx/timeout — directly
 * easing the rate-limit failures. Returns OpenAI-shaped completions
 * (`{ choices: [{ message }] }`) so existing call sites read `.choices[0].message.content`
 * unchanged.
 *
 * Routing split preserved: generation (MCQ filler, topics) uses the cheap 'fast'
 * tier; graded feedback uses the stronger 'gen' (70B-class) tier. Failover means a
 * better grader is a STRICT improvement — a throttled/failed provider falls through
 * to the next instead of turning feedback into none.
 *
 * NOTE: PII routes (resume) must NOT use these helpers — they use the Groq-only
 * piiPool directly (see agent/llm.js), since this pool includes providers that may
 * train on inputs.
 */

const llm = require('../agent/llm');
const { config } = require('../config/env');

const GEN_MODEL = () => config.groqGenModel();
const EVAL_MODEL = () => config.groqEvalModel();

// Wrap a portable `message` back into the OpenAI completion shape callers expect.
const wrap = (message, model) => ({ choices: [{ message }], model });

/**
 * One completion across the non-PII failover pool. `params` are the usual
 * chat.completions.create params (messages, temperature, max_tokens, response_format…);
 * `model` is ignored in favor of the pool's per-provider model for `tier`.
 * @param {object} params
 * @param {'fast'|'gen'|'strong'|'plan'} [tier]
 */
async function chatCompletion(params = {}, tier = 'fast') {
  const { model, ...rest } = params; // drop any hardcoded model; the pool picks per provider
  let pool = llm.fastPool(tier);
  // Cerebras free caps total context at ~8k tokens; for large-output calls, drop it
  // so a long generation can't be truncated mid-JSON (Groq/OpenRouter handle it).
  if ((rest.max_tokens || 0) > 4000) pool = pool.filter((c) => c.provider !== 'cerebras');
  const meta = {};
  const message = await llm.chatWithFailover({ pool, meta, ...rest });
  return wrap(message, meta.model);
}

/**
 * Graded-feedback completion: routes the non-PII pool at the stronger 'gen' tier,
 * with failover replacing the old eval→gen fall-through. Returns the completion AND
 * the model that produced it (callers record which grader was used).
 * @param {object} params  chat params WITHOUT a meaningful `model`
 * @returns {Promise<{ completion: any, modelUsed: string }>}
 */
async function evalCompletion(params = {}) {
  const { model, ...rest } = params;
  const meta = {};
  const message = await llm.chatWithFailover({ pool: llm.fastPool('gen'), meta, ...rest });
  return { completion: wrap(message, meta.model), modelUsed: meta.model };
}

module.exports = { GEN_MODEL, EVAL_MODEL, evalCompletion, chatCompletion };
