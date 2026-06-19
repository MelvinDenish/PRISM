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

// baseUrl/apiKey are optional per-call overrides so a caller (e.g. the resume
// generator) can target a DIFFERENT OpenAI-compatible provider than the copilot
// without touching global config. When omitted, the global LLM_* config is used.
function endpoint(baseUrl) {
  const base = ((baseUrl || config.llmBaseUrl()) || GROQ_DEFAULT_BASE).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

function headers(apiKey, baseUrl) {
  const key = apiKey || config.llmApiKey();
  if (!key) throw new Error('LLM not configured (set LLM_API_KEY or GROQ_API_KEY)');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  // OpenRouter recommends attribution headers (optional; ignored elsewhere).
  if (/openrouter\.ai/i.test(baseUrl || config.llmBaseUrl())) {
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
async function chat({ messages, tools, model, temperature = 0.3, max_tokens = 1500, tool_choice, baseUrl, apiKey, response_format, timeoutMs }) {
  const body = { model: model || ORCHESTRATOR_MODEL(), messages, temperature, max_tokens };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = tool_choice || 'auto';
  }
  // Optional OpenAI-compatible JSON mode (used by the resume content stage).
  if (response_format) body.response_format = response_format;

  // Hard timeout so a hung/queued provider request can never freeze the whole chat
  // turn (the old code awaited fetch with no deadline). Covers both the request and
  // the response-body read.
  const controller = new AbortController();
  // Per-call timeout override (resume design uses a longer one — large free models on
  // OpenRouter can take well over the 30s default to author a full HTML resume).
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS());

  let res, text;
  try {
    res = await fetch(endpoint(baseUrl), {
      method: 'POST',
      headers: headers(apiKey, baseUrl),
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

// ── Multi-provider failover ───────────────────────────────────────────────────
//
// A "pool" is an ORDERED list of OpenAI-compatible candidates
// `[{ provider, baseUrl, apiKey, model }, ...]`. chatWithFailover() tries each in
// turn and advances to the next on ANY error while a candidate remains — only the
// LAST candidate's error propagates. Failing over on 4xx too (not just 429/5xx/
// timeout) is deliberate: Cerebras's ~8k context cap and any stale/wrong model id
// surface as 400/404/413, and those MUST fall through to the next provider (e.g.
// Groq's 128k) rather than hard-fail. The only cost — burning the pool on a genuinely
// malformed request — is a dev-time bug, caught fast and far cheaper than a user-facing
// outage. Returns the first success; throws the last error if every candidate fails.
//
// Two pools, split by privacy (see config/env.js):
//   fastPool(tier)  — non-PII: Cerebras → Groq → OpenRouter (key-filtered).
//   piiPool(tier)   — student PII (resume): Groq only (privacy-safe, no training).
//
// `tier` selects the model per provider: 'fast' (cheap/quick), 'gen' (70B-class),
// 'strong' (120B/235B-class), 'plan' (strongest reasoner). Override ids per
// deployment by editing PROVIDER_MODELS or passing an explicit `model`.

// Per-provider model id per tier. Cerebras (fastest + 1M tok/day free) is tried first by
// fastPool, so its ids must be ones the key actually serves — today: zai-glm-4.7 (strong
// GLM coder/generalist) + gpt-oss-120b. (The old llama-3.3-70b / qwen-3-235b ids 404'd on
// the current Cerebras lineup, silently dropping every call through to Groq.) OpenRouter is
// the last failover; its free ids rotate — refreshed to currently-live ones.
const PROVIDER_MODELS = {
  groq:       { fast: 'llama-3.1-8b-instant',              gen: 'llama-3.3-70b-versatile', strong: 'openai/gpt-oss-120b',          plan: 'openai/gpt-oss-120b' },
  cerebras:   { fast: 'gpt-oss-120b',                      gen: 'zai-glm-4.7',             strong: 'zai-glm-4.7',                  plan: 'zai-glm-4.7' },
  openrouter: { fast: 'meta-llama/llama-3.3-70b-instruct:free', gen: 'openai/gpt-oss-120b:free', strong: 'qwen/qwen3-coder:free', plan: 'qwen/qwen3-next-80b-a3b-instruct:free' },
};

const groqCandidate = (tier) => ({ provider: 'groq', baseUrl: '', apiKey: config.groqApiKey() || config.llmApiKey(), model: PROVIDER_MODELS.groq[tier] });

/** Non-PII pool: fastest first (Cerebras), Groq, then OpenRouter. Skips unkeyed providers. */
function fastPool(tier = 'gen') {
  const out = [];
  if (config.hasCerebras()) out.push({ provider: 'cerebras', baseUrl: config.cerebrasBaseUrl(), apiKey: config.cerebrasApiKey(), model: PROVIDER_MODELS.cerebras[tier] });
  if (config.hasGroq() || config.llmApiKey()) out.push(groqCandidate(tier));
  if (config.hasOpenrouter()) out.push({ provider: 'openrouter', baseUrl: config.openrouterBaseUrl(), apiKey: config.openrouterApiKey(), model: PROVIDER_MODELS.openrouter[tier] });
  return out;
}

/** PII-safe pool: Groq only, with explicit Groq creds (independent of RESUME_LLM_* base,
 *  which may now point at OpenRouter). Keeps the legacy /generate + /cover-letter paths on
 *  Groq model ids instead of sending them to a different provider. */
function piiPool(tier = 'gen') {
  return [groqCandidate(tier)];
}

/** Resume design candidates — one per configured design slug, on the resume provider creds
 *  (RESUME_LLM_*; OpenRouter by default now). best-of-N drafts across the first 1–2 of these. */
function resumeDesignCandidates() {
  const base = config.resumeLlmBaseUrl();
  const apiKey = config.resumeLlmApiKey();
  const provider = /openrouter\.ai/i.test(base) ? 'openrouter' : (base ? 'custom' : 'groq');
  return config.resumeDesignModels().map((model) => ({ provider, baseUrl: base, apiKey, model }));
}

/** Last-resort design proposer on Groq's top free model — used only if the primary design
 *  pool is exhausted (e.g. all OpenRouter candidates 429). Always available when a Groq key
 *  is set. (NB: Groq's free TPM cap may reject a very large exemplar prompt; best-effort.) */
function groqDesignFallback() {
  return { provider: 'groq', baseUrl: '', apiKey: config.groqApiKey() || config.llmApiKey(), model: 'openai/gpt-oss-120b' };
}

/**
 * chat() across an ordered candidate pool with failover. Per-candidate `model`
 * overrides `params.model`. Falls back to the single-provider chat() when no pool
 * is given (so existing callers keep working). Returns the assistant `message`.
 * @param {object} params  chat() params PLUS `pool` (the candidate array) and an
 *   optional `meta` out-object that gets `{ provider, model }` of the winner.
 */
async function chatWithFailover({ pool, meta, ...params }) {
  const candidates = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (candidates.length === 0) return chat(params); // no pool → global single provider

  let lastErr;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      const message = await chat({ ...params, model: c.model || params.model, baseUrl: c.baseUrl, apiKey: c.apiKey });
      if (meta) { meta.provider = c.provider; meta.model = c.model || params.model; }
      return message;
    } catch (err) {
      lastErr = err;
      // Fail over on ANY error while a candidate remains (see header: 4xx from
      // Cerebras's context cap / a wrong model id must fall through, not hard-fail).
      if (i < candidates.length - 1) {
        console.warn(`⚠️  LLM provider "${c.provider || c.baseUrl || 'groq'}" failed (${err.status || err.message}); failing over to "${candidates[i + 1].provider || 'next'}".`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = {
  chat, chatStream, chatWithFailover, fastPool, piiPool, PROVIDER_MODELS,
  resumeDesignCandidates, groqDesignFallback,
  ORCHESTRATOR_MODEL, GEN_MODEL, FAST_MODEL,
};
