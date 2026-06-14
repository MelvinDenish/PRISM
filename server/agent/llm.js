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

// Per-request deadline (ms). Overridable via LLM_TIMEOUT_MS; defaults to 30s, long
// enough for a slow generation but short enough that a stalled provider fails fast.
const TIMEOUT_MS = () => Number(process.env.LLM_TIMEOUT_MS) || 30000;

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

  // Hard timeout so a hung/queued provider request can never freeze the whole chat
  // turn (the old code awaited fetch with no deadline). Covers both the request and
  // the response-body read.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS());

  let res, text;
  try {
    res = await fetch(endpoint(), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    text = await res.text();
  } catch (netErr) {
    if (netErr.name === 'AbortError') {
      const e = new Error(`LLM request timed out after ${TIMEOUT_MS()}ms`);
      e.timeout = true;
      throw e;
    }
    const e = new Error(`LLM request failed: ${netErr.message}`);
    e.cause = netErr;
    throw e;
  } finally {
    clearTimeout(timer);
  }

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

/**
 * Streaming chat-completion turn (OpenAI-compatible `stream: true`). Forwards each
 * assistant content delta to `onToken(text)` as it arrives, while accumulating any
 * `tool_calls` (which stream as index-keyed fragments of name + arguments). Resolves
 * to the same `message` shape as chat(): `{ role, content, tool_calls? }`.
 *
 * Errors mirror chat(): `.timeout` on the deadline, `.status`/`.error` on a non-2xx.
 * @param {object} params
 * @param {Array}  params.messages
 * @param {Array}  [params.tools]
 * @param {string} [params.model]
 * @param {number} [params.temperature]
 * @param {number} [params.max_tokens]
 * @param {string|object} [params.tool_choice]
 * @param {(text:string)=>void} [params.onToken]
 */
async function chatStream({ messages, tools, model, temperature = 0.3, max_tokens = 1500, tool_choice, onToken }) {
  const body = { model: model || ORCHESTRATOR_MODEL(), messages, temperature, max_tokens, stream: true };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = tool_choice || 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS());

  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      let json = null;
      try { json = errText ? JSON.parse(errText) : null; } catch { /* non-JSON */ }
      const e = new Error(json?.error?.message || `LLM HTTP ${res.status}`);
      e.status = res.status;
      e.error = json?.error || { message: errText.slice(0, 300) };
      throw e;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolAcc = []; // index → { id, type, function: { name, arguments } }

    // Parse the SSE byte stream line-by-line. Each event is a `data: {json}` line;
    // a partial line at a chunk boundary stays buffered until the next read completes it.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        let chunk;
        try { chunk = JSON.parse(data); } catch { continue; }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.content === 'string' && delta.content) {
          content += delta.content;
          if (onToken) onToken(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAcc[idx]) toolAcc[idx] = { id: tc.id || `call_${idx}`, type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) toolAcc[idx].id = tc.id;
            if (tc.function?.name) toolAcc[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolAcc[idx].function.arguments += tc.function.arguments;
          }
        }
      }
    }

    const tool_calls = toolAcc.filter(Boolean);
    return tool_calls.length
      ? { role: 'assistant', content, tool_calls }
      : { role: 'assistant', content };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`LLM request timed out after ${TIMEOUT_MS()}ms`);
      e.timeout = true;
      throw e;
    }
    if (err.status) throw err; // already a structured HTTP error
    const e = new Error(`LLM request failed: ${err.message}`);
    e.cause = err;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chat, chatStream, ORCHESTRATOR_MODEL, GEN_MODEL, FAST_MODEL };
