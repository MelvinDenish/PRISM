/**
 * Provider-agnostic, OpenAI-compatible LLM client for the agentic assistant
 * ("PRISM Copilot").
 *
 * We talk to the standard `POST {baseURL}/chat/completions` endpoint with a plain
 * `fetch` rather than a vendor SDK. (groq-sdk injects its own `/openai/v1` path
 * prefix onto baseURL, which 404s against OpenRouter/Together/etc. — so it is NOT
 * portable.) A direct fetch is fully provider-agnostic and adds no dependency:
 * point LLM_BASE_URL at Groq / OpenRouter / Together / Fireworks / DeepInfra and
 * the request/response shape (messages, tools, tool_calls) is identical.
 */

const { config } = require('../config/env');

const GROQ_DEFAULT_BASE = 'https://api.groq.com/openai/v1';

const ORCHESTRATOR_MODEL = () => config.llmOrchestratorModel();
const GEN_MODEL = () => config.llmGenModel();
const FAST_MODEL = () => config.llmFastModel();

function endpoint() {
  const base = (config.llmBaseUrl() || GROQ_DEFAULT_BASE).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

function headers() {
  const apiKey = config.llmApiKey();
  if (!apiKey) throw new Error('LLM not configured (set LLM_API_KEY or GROQ_API_KEY)');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  // OpenRouter recommends attribution headers (optional; ignored elsewhere).
  if (/openrouter\.ai/i.test(config.llmBaseUrl())) {
    h['HTTP-Referer'] = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    h['X-Title'] = 'PRISM Copilot';
  }
  return h;
}

/**
 * One chat-completion turn. Returns the assistant `message` object (with any
 * `tool_calls`). Throws on a non-2xx response; the thrown error carries `.status`
 * and `.error` (the provider's error body) so callers can detect/​salvage the
 * `tool_use_failed` failure mode.
 * @param {object} params
 * @param {Array}  params.messages
 * @param {Array}  [params.tools]
 * @param {string} [params.model]  defaults to the orchestrator model
 * @param {number} [params.temperature]
 * @param {number} [params.max_tokens]
 * @param {string|object} [params.tool_choice]
 */
async function chat({ messages, tools, model, temperature = 0.3, max_tokens = 1500, tool_choice }) {
  const body = { model: model || ORCHESTRATOR_MODEL(), messages, temperature, max_tokens };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = tool_choice || 'auto';
  }

  let res;
  try {
    res = await fetch(endpoint(), { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  } catch (netErr) {
    const e = new Error(`LLM request failed: ${netErr.message}`);
    e.cause = netErr;
    throw e;
  }

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON (e.g. HTML error page) */ }

  if (!res.ok) {
    const e = new Error(json?.error?.message || `LLM HTTP ${res.status}`);
    e.status = res.status;
    e.error = json?.error || { message: text?.slice(0, 300) };
    throw e;
  }

  const message = json?.choices?.[0]?.message;
  if (!message) {
    const e = new Error('LLM returned no message');
    e.error = json?.error;
    throw e;
  }
  return message;
}

module.exports = { chat, ORCHESTRATOR_MODEL, GEN_MODEL, FAST_MODEL };
