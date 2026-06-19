# Resume Quality Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-authored resumes look professionally designed and content-rich by moving the pipeline to the strongest free models (OpenRouter, with Groq as a resilience fallback), upgrading the vision judge, adding few-shot exemplars + a researched design catalog, and enriching grounded content.

**Architecture:** The resume pipeline already runs a best-of-N + vision-critic refine loop (`authorHtml` → `refineLoop` → `verifyDesign`). This plan (1) repairs and broadens the model layer so best-of-N actually diverges across top free design models with a Groq fallback, (2) upgrades the vision critic, (3) replaces random style seeds with a curated, research-backed design-system catalog, (4) injects hand-crafted gold HTML exemplars into the design prompt, and (5) strengthens grounded content prompts. Provider/model selection stays env-driven so a key-less deployment degrades to today's Groq behavior.

**Tech Stack:** Node.js (CommonJS) Express server, OpenAI-compatible `fetch` LLM client (`server/agent/llm.js`), Puppeteer headless render (`server/agent/services/resumePdf.js`), `sanitize-html`, Google-Fonts inlining (`server/agent/services/resumeFonts.js`).

## Global Constraints

- **CommonJS** on the server (`require`/`module.exports`) — never ESM. (CLAUDE.md)
- **No test runner** is configured. "Tests" in this plan are small standalone Node assertion scripts run with `node path/to/script.js` (exit non-zero on failure), following the repo's existing `server/seeds/verifyPhase*.js` convention — NOT Jest/Vitest.
- All AI calls go through `server/agent/llm.js` (`chat` / `chatWithFailover`); never import a vendor SDK or call `fetch` to a provider directly. (CLAUDE.md)
- Response shape for routes stays `{ success: boolean, ... }`. Never repurpose 401. (CLAUDE.md)
- JSON-returning prompts strip ```` ```json ```` fences before `JSON.parse` (existing pattern — preserve).
- Fonts named in any design/catalog/exemplar MUST be Google / open-source family names so `inlineFontsForHtml` can embed them. Never rely on Arial/Times/system fonts.
- Grounding rule is absolute: content prompts must NEVER invent employers, degrees, dates, metrics, or links not present in the input. This is unchanged and load-bearing for a placement platform.
- Privacy: the user has explicitly accepted that resume data leaves Groq for OpenRouter. Do not re-add a privacy gate. Keep Groq wired only as a *resilience* fallback.
- Commit after each task. Branch: `feat/agentic-multimodel-free-tier`. Do not push or open a PR until the user asks (memory: final push/PR to `main` after completion).

## Recommended Build Order (de-risked)

Execute in **two phases**, not strict task-number order, so the high-certainty wins land first and provider flakiness can't mask them:

- **Phase 1 — provider-independent lift (stays on Groq, can never 429 back to baseline):** Task 0 (baseline) → Task 4 *Step A only* (fix the dead-proposer default so best-of-N diverges on two live Groq models) → Task 6 (catalog) → Task 7 (critic-validated exemplars) → Task 8 (content). Re-score against the baseline here: this is where you confirm the "boring" complaint is actually fixed, with clean attribution.
- **Phase 2 — provider migration (upside, higher variance):** Task 1 → Task 2 → Task 3 → Task 4 (rest) → Task 5. Move *design + content* to OpenRouter, but **keep the vision critic on reliable Groq** (a critic 429 silently ships ungated generic — reliability beats judge strength here).

---

### Task 0: Capture a "before" baseline

You diagnosed from code, not output. Get one concrete before-artifact + score to beat.

**Files:**
- Create: `server/seeds/captureResumeBaseline.js` (throwaway; may be deleted after)

- [ ] **Step 1: Render + score current output**

Write a small script that takes a representative shaped-content object (reuse `shapeAuthorContent` on a realistic fixture, or pull a recent real draft's content), runs the CURRENT `authorHtml`, writes the resulting HTML to `server/tmp/baseline-{1,2}.html`, and logs `meta` (esp. `models`, `candidates`, `verified`, `visionScore`, `pages`, `fillRatio`). Run it twice.

Run: `cd server && node seeds/captureResumeBaseline.js`
Expected: two HTML files saved + two `meta` blocks logged. **Record the `visionScore`(s) and open the HTML — this is the bar to beat.** Note whether `candidates` is really 2 (it may already reveal the collapsed best-of-N).

- [ ] **Step 2: Commit the baseline note**

Save the recorded scores into the design spec's "Problem" section (a one-line "baseline visionScore ≈ N, see tmp/baseline-*.html") and commit:
```bash
git add docs/superpowers/specs/2026-06-18-resume-quality-upgrade-design.md
git commit -m "docs(resume): record pre-upgrade baseline design scores"
```
(`server/tmp/` is throwaway — add to `.gitignore` if not already ignored; don't commit the HTML.)

---

### Task 1: Resolve current free model IDs from OpenRouter

OpenRouter `:free` slugs rotate; pin the live ones before wiring config so defaults are real.

**Files:**
- Modify: `server/.env` (gitignored — local only)
- Modify: `server/.env.example` (documentation of the new vars)

- [ ] **Step 1: Look up + SMOKE-TEST current best free models**

Query OpenRouter's live model list (web) and pick:
- Two strong, *stylistically different* free coding models for design best-of-N (candidates: a Kimi-K2 / Qwen3-Coder / DeepSeek-V4 family `:free` slug).
- One strong free writer for content (a DeepSeek-V4 / Qwen3 `:free` slug).

**Do NOT trust listing-page slugs** (research returned suspicious/fabricated IDs like `owl-alpha`, `qwen3.6-27b`, dated `deepseek-v4-flash-...`). Smoke-test each candidate with one real completion before adopting:
```bash
cd server && node -e "
require('dotenv').config();
const llm=require('./agent/llm');
(async()=>{ const m=await llm.chat({baseUrl:'https://openrouter.ai/api/v1', apiKey:process.env.OPENROUTER_API_KEY, model:'<SLUG>', max_tokens:20, messages:[{role:'user',content:'say hi'}]}); console.log('OK', m.content?.slice(0,40)); })().catch(e=>{console.error('FAIL', e.status, e.message); process.exit(1)});
"
```
Run once per candidate slug; only adopt slugs that print `OK`. Record the confirmed slugs for Step 2.

NOTE on the vision critic: it stays on **reliable Groq** (`meta-llama/llama-4-scout-17b-16e-instruct`), NOT OpenRouter — a critic 429 makes `verifyDesign` ship ungated generic (see Task 5). So Step 2 does NOT move `RESUME_VISION_MODEL`.

- [ ] **Step 2: Set resume provider + models in `server/.env`**

Append (use the smoke-tested slugs from Step 1):

```
# Resume pipeline → OpenRouter for DESIGN + CONTENT (best free quality; Groq stays as code fallback)
RESUME_LLM_BASE_URL=https://openrouter.ai/api/v1
RESUME_LLM_API_KEY=<same value as OPENROUTER_API_KEY>
RESUME_DESIGN_MODELS=<smoke-tested-design-slug-1>,<smoke-tested-design-slug-2>
RESUME_CONTENT_MODEL=<smoke-tested-writer-slug>
# Vision critic pinned to reliable Groq (NOT OpenRouter) — Task 5 adds these getters:
RESUME_VISION_BASE_URL=
RESUME_VISION_API_KEY=<same value as GROQ_API_KEY>
RESUME_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

- [ ] **Step 3: Document the vars in `server/.env.example`**

Add the same five keys with placeholder values and a one-line comment each, matching the file's existing style.

- [ ] **Step 4: Verify the key resolves**

Run:
```bash
cd server && node -e "require('dotenv').config(); const {config}=require('./config/env'); console.log({base:config.resumeLlmBaseUrl(), hasKey:Boolean(config.resumeLlmApiKey()), design:config.resumeDesignModels(), content:config.resumeContentModel(), vision:config.resumeVisionModel()})"
```
Expected: `base` is the OpenRouter URL, `hasKey` is `true`, `design` is your 2-slug array, `content`/`vision` are your slugs.

- [ ] **Step 5: Commit**

```bash
git add server/.env.example
git commit -m "chore(resume): document OpenRouter provider env for resume pipeline"
```
(`.env` is gitignored — not committed.)

---

### Task 2: Decouple `piiPool` from the resume provider creds

**Problem:** `piiPool()` builds a Groq-model-ID candidate but points it at `resumeLlmBaseUrl` (now OpenRouter), so `/generate` + `/cover-letter` would send `llama-3.3-70b-versatile` to OpenRouter and 404. `groqCandidate(tier)` already encodes correct Groq creds.

**Files:**
- Modify: `server/agent/llm.js:257-259`
- Test: `server/seeds/verifyResumeQuality.js` (create)

**Interfaces:**
- Produces: `piiPool(tier)` → `[{ provider:'groq', baseUrl:'', apiKey:<groq key>, model:<groq model id> }]` (baseUrl `''` resolves to Groq's default base in `endpoint()`).

- [ ] **Step 1: Write the failing check**

Create `server/seeds/verifyResumeQuality.js`:
```js
/* Standalone assertions for the resume-quality upgrade. Run: node seeds/verifyResumeQuality.js */
require('dotenv').config();
const assert = require('assert');
const llm = require('../agent/llm');

function checkPiiPoolUsesGroqBase() {
  const pool = llm.piiPool('gen');
  assert.strictEqual(pool.length, 1, 'piiPool should have one Groq candidate');
  const c = pool[0];
  assert.strictEqual(c.provider, 'groq', 'piiPool candidate must be groq');
  assert.ok(c.baseUrl === '' || /api\.groq\.com/.test(c.baseUrl), 'piiPool must target Groq base, not the OpenRouter resume base');
  assert.ok(/llama-3\.3-70b/.test(c.model), 'piiPool gen tier should be a Groq model id');
  console.log('OK: piiPool decoupled from resume provider');
}

checkPiiPoolUsesGroqBase();
console.log('\nAll resume-quality checks passed.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && RESUME_LLM_BASE_URL=https://openrouter.ai/api/v1 node seeds/verifyResumeQuality.js`
Expected: AssertionError on the `baseUrl` check (current `piiPool` uses the OpenRouter resume base).

- [ ] **Step 3: Fix `piiPool`**

In `server/agent/llm.js`, replace the body of `piiPool`:
```js
/** PII-safe pool: Groq only, with explicit Groq creds (independent of RESUME_LLM_* base). */
function piiPool(tier = 'gen') {
  return [groqCandidate(tier)];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && RESUME_LLM_BASE_URL=https://openrouter.ai/api/v1 node seeds/verifyResumeQuality.js`
Expected: `OK: piiPool decoupled from resume provider`.

- [ ] **Step 5: Commit**

```bash
git add server/agent/llm.js server/seeds/verifyResumeQuality.js
git commit -m "fix(resume): decouple piiPool from RESUME_LLM_* base so legacy routes stay on Groq"
```

---

### Task 3: Route `/generate` + `/cover-letter` through the content-model creds

Privacy is no longer a constraint; these two endpoints should use the chosen content model (OpenRouter) like the rest of the pipeline, instead of the Groq-only `piiPool`.

**Files:**
- Modify: `server/routes/resumeBuilder.js:20-28` (the `piiCompletion` helper) and its two call sites (`/generate` ~line 340, `/cover-letter` ~line 646)

**Interfaces:**
- Produces: `contentCompletion(params)` → `{ choices: [{ message }] }` using `config.resumeLlmBaseUrl()/resumeLlmApiKey()/resumeContentModel()`, so existing `.choices[0].message.content` reads are unchanged.

- [ ] **Step 1: Replace the helper**

Replace `piiCompletion` (lines ~20-28) with:
```js
// Content completion for resume/cover-letter text: routes the configured resume
// CONTENT model + provider (RESUME_LLM_* — OpenRouter by default now) and returns an
// OpenAI-shaped completion so existing `.choices[0].message.content` reads are unchanged.
const contentCompletion = async (params = {}) => {
  const { model, ...rest } = params;
  const message = await llm.chat({
    baseUrl: config.resumeLlmBaseUrl(),
    apiKey: config.resumeLlmApiKey(),
    model: model || config.resumeContentModel(),
    ...rest,
  });
  return { choices: [{ message }] };
};
```

- [ ] **Step 2: Add the config require**

At the top of `server/routes/resumeBuilder.js`, ensure `const { config } = require('../config/env');` is present (add if missing).

- [ ] **Step 3: Update both call sites**

In `/generate`: change `await piiCompletion({ ... }, 'gen')` to `await contentCompletion({ ... })` (drop the tier arg).
In `/cover-letter`: same change.

- [ ] **Step 4: Verify the route boots and responds**

Run: `cd server && node --watch server.js` (in a background shell), then from another shell hit `/api/resume-builder/cover-letter` with a valid token and a minimal body, OR if no token handy, just confirm the server boots with no `piiCompletion is not defined` error and the file lints.
Run: `cd server && npx eslint routes/resumeBuilder.js` → Expected: no errors for `piiCompletion`/`contentCompletion`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/resumeBuilder.js
git commit -m "feat(resume): route generate + cover-letter through the configured content model"
```

---

### Task 4: Multi-provider design pool with Groq resilience fallback

Make best-of-N draft across two *different* OpenRouter design models, repairing with the primary, and fall back to a Groq `gpt-oss-120b` proposer if the OpenRouter pool is exhausted (e.g. all 429).

**Files:**
- Modify: `server/agent/llm.js` (add `resumeDesignCandidates()` + `groqDesignFallback()` exports)
- Modify: `server/agent/services/resumeAuthor.js:219-300` (`authorHtml`)
- Modify: `server/config/env.js` (no new getter needed; `resumeDesignModels()` already returns the slug array)
- Test: `server/seeds/verifyResumeQuality.js` (extend)

**Interfaces:**
- Consumes: `config.resumeDesignModels()` (string[]), `config.resumeLlmBaseUrl()`, `config.resumeLlmApiKey()`, `config.groqApiKey()`.
- Produces:
  - `llm.resumeDesignCandidates()` → `[{ provider, baseUrl, apiKey, model }]` — one per configured design slug, all on the resume provider creds.
  - `llm.groqDesignFallback()` → `{ provider:'groq', baseUrl:'', apiKey:<groq>, model:'openai/gpt-oss-120b' }`.
  - `authorHtml({ content, instruction, vision })` unchanged signature/return; internally drafts via candidate objects and falls back to Groq.

- [ ] **Step A (Phase 1 — do FIRST, independent of OpenRouter): fix the dead-proposer default**

In `server/config/env.js:198`, the `resumeDesignModels()` fallback still lists `'moonshotai/kimi-k2-instruct'` (deprecated on Groq → collapses best-of-N). Replace the default array with two LIVE Groq models so divergence works even with no env override:
```js
return [primary, 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'];
```
This alone restores real best-of-N on the Groq path. Commit:
```bash
git add server/config/env.js
git commit -m "fix(resume): replace deprecated kimi-k2 in design pool default with live Groq models"
```

- [ ] **Step 1: Add the candidate builders to `llm.js`**

After `piiPool`, add:
```js
/** Resume design candidates — one per configured design slug, on the resume provider creds. */
function resumeDesignCandidates() {
  const base = config.resumeLlmBaseUrl();
  const apiKey = config.resumeLlmApiKey();
  const provider = /openrouter\.ai/i.test(base) ? 'openrouter' : (base ? 'custom' : 'groq');
  return config.resumeDesignModels().map((model) => ({ provider, baseUrl: base, apiKey, model }));
}

/** Last-resort design proposer on Groq's top free model (always available when GROQ key set). */
function groqDesignFallback() {
  return { provider: 'groq', baseUrl: '', apiKey: config.groqApiKey() || config.llmApiKey(), model: 'openai/gpt-oss-120b' };
}
```
Add both to `module.exports`.

- [ ] **Step 2: Extend the verify script**

Append to `server/seeds/verifyResumeQuality.js` before the final log line:
```js
function checkDesignCandidates() {
  const cands = llm.resumeDesignCandidates();
  assert.ok(cands.length >= 1, 'expected at least one design candidate');
  assert.ok(cands.every((c) => c.model && 'baseUrl' in c && 'apiKey' in c), 'each candidate needs model/baseUrl/apiKey');
  const fb = llm.groqDesignFallback();
  assert.strictEqual(fb.provider, 'groq');
  assert.ok(/gpt-oss-120b/.test(fb.model), 'groq fallback should be gpt-oss-120b');
  console.log('OK: design candidates + groq fallback');
}
checkDesignCandidates();
```

- [ ] **Step 3: Run to verify it passes (builders exist)**

Run: `cd server && node seeds/verifyResumeQuality.js`
Expected: `OK: design candidates + groq fallback`.

- [ ] **Step 4: Rewire `authorHtml` to use candidates + fallback**

In `server/agent/services/resumeAuthor.js`, replace the model-wiring block in `authorHtml` (currently lines ~224-247 building `baseUrl/apiKey/models/primary/makeProposer/repair`) with a per-pool factory so creds stay consistent across proposers and repair, and add a Groq retry:

```js
const useVision = vision === undefined ? config.hasResumeVision() : vision;
const contentJson = JSON.stringify(content);
const steer = instruction ? `DESIGN INSTRUCTION:\n${String(instruction).slice(0, 400)}` : null;

const designCandidates = llm.resumeDesignCandidates();
const groqFallback = llm.groqDesignFallback();

// Build proposer + repair fns bound to a specific candidate pool, so a Groq retry
// repairs with Groq creds (not stale OpenRouter creds).
const buildPool = (candidates) => {
  const primary = candidates[0];
  const proposerCands = useVision ? candidates.slice(0, 2) : candidates.slice(0, 1);
  const makeProposer = (cand) => async () => {
    const message = await llm.chat({
      baseUrl: cand.baseUrl, apiKey: cand.apiKey, model: cand.model,
      temperature: 0.85, max_tokens: 8000,
      messages: [
        { role: 'system', content: designSystemPrompt() },
        { role: 'user', content: `RESUME CONTENT (JSON):\n${contentJson}\n\n${steer || styleSeed()}` },
      ],
    });
    const prepared = await prepareHtml(message.content || '');
    return { ...prepared, model: cand.model };
  };
  const repair = async (candidate, feedback) => {
    const message = await llm.chat({
      baseUrl: primary.baseUrl, apiKey: primary.apiKey, model: primary.model,
      temperature: 0.55, max_tokens: 8000,
      messages: [
        { role: 'system', content: agenticRepairPrompt() },
        { role: 'user', content: `REVIEWER FEEDBACK:\n${feedback}\n\nCURRENT HTML:\n${(candidate.sanitized || '').slice(0, 16000)}` },
      ],
    });
    return prepareHtml(message.content || '');
  };
  return { proposers: proposerCands.map(makeProposer), repair };
};

const verify = (candidate) => verifyDesign({ inlined: candidate.inlined, content, useVision });
const runLoop = (pool) => refineLoop({
  proposers: pool.proposers, verify, repair: pool.repair,
  maxN: useVision ? 5 : 3,
  deadlineMs: Number(process.env.RESUME_GEN_DEADLINE_MS) || 60000,
});

let out;
try {
  out = await runLoop(buildPool(designCandidates));
} catch (err) {
  const status = err.status || err.cause?.status;
  const exhausted = status === 429 || /every proposer failed/i.test(err.message || '');
  if (exhausted && groqFallback.apiKey) {
    out = await runLoop(buildPool([groqFallback]));   // resilience: ship a Groq design
  } else {
    const e = new Error(`Resume design model failed: ${err.cause?.message || err.message}`);
    e.statusCode = status === 429 ? 429 : 502; throw e;
  }
}
```
Keep the existing `const { candidate, result, rounds } = out;` block and `meta`/return below unchanged, BUT update `meta.models` to reflect the candidates actually used:
```js
const meta = {
  model: candidate.model || (designCandidates[0] && designCandidates[0].model),
  models: designCandidates.map((c) => c.model),
  candidates: useVision ? Math.min(2, designCandidates.length) : 1,
  repairs: rounds, rounds, verified,
  fillRatio: m.fillRatio || 0, pages: m.pages || 1,
  ...(useVision && m.visionScore != null ? { visionModel: config.resumeVisionModel(), visionScore: m.visionScore } : {}),
  ...(verified ? {} : { lastProblem: result.feedback }),
};
```
Remove the now-unused `const baseUrl/apiKey/models/primary` lines and the old standalone `makeProposer`/`repair`/`proposerModels`.

- [ ] **Step 5: Confirm `authorHtml` still parses + imports**

Run: `cd server && npx eslint agent/services/resumeAuthor.js`
Expected: no `no-undef`/unused errors (note: `llm` is already required at top of file).

- [ ] **Step 6: Commit**

```bash
git add server/agent/llm.js server/agent/services/resumeAuthor.js server/seeds/verifyResumeQuality.js
git commit -m "feat(resume): cross-provider best-of-N design pool with Groq resilience fallback + raise max_tokens"
```

---

### Task 5: Point the vision critic at its own (stronger) model/creds

The critic must run on a vision-capable model. The independent creds added here let the critic stay on **reliable Groq** (`llama-4-scout`) while design drafts on OpenRouter — deliberate: if the critic 429s, `verifyDesign` returns a structural-only `pass:true` and refineLoop ships the first draft *ungated* (generic). Reliability of the judge matters more than its raw strength. (A stronger OpenRouter vision critic is a later optional upgrade once reliability is proven.) Task 1 Step 2 pins `RESUME_VISION_*` to Groq; these getters make that resolution explicit and robust.

**Files:**
- Modify: `server/config/env.js` (add `resumeVisionBaseUrl`/`resumeVisionApiKey` getters defaulting to the resume creds)
- Modify: `server/agent/core/designCritic.js:86-94` (`critiqueDesign`)

**Interfaces:**
- Produces: `config.resumeVisionBaseUrl()` / `config.resumeVisionApiKey()` (default to `resumeLlmBaseUrl()`/`resumeLlmApiKey()`); `critiqueDesign` uses them.

- [ ] **Step 1: Add config getters**

In `server/config/env.js`, after `resumeVisionModel`, add:
```js
resumeVisionBaseUrl: () => process.env.RESUME_VISION_BASE_URL || process.env.RESUME_LLM_BASE_URL || process.env.LLM_BASE_URL || '',
resumeVisionApiKey: () => process.env.RESUME_VISION_API_KEY || process.env.RESUME_LLM_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
```

- [ ] **Step 2: Use them in `critiqueDesign`**

In `server/agent/core/designCritic.js`, change the `llm.chat` creds in `critiqueDesign`:
```js
baseUrl: config.resumeVisionBaseUrl(),
apiKey: config.resumeVisionApiKey(),
model: config.resumeVisionModel(),
```

- [ ] **Step 3: Verify getters resolve**

Run: `cd server && node -e "require('dotenv').config(); const {config}=require('./config/env'); console.log({vbase:config.resumeVisionBaseUrl(), vkey:Boolean(config.resumeVisionApiKey()), vmodel:config.resumeVisionModel()})"`
Expected: `vbase` = OpenRouter URL, `vkey` true, `vmodel` = your vision slug.

- [ ] **Step 4: Commit**

```bash
git add server/config/env.js server/agent/core/designCritic.js
git commit -m "feat(resume): give the design vision critic its own resolved creds"
```

---

### Task 6: Researched, curated design-system catalog

Replace the random orthogonal `ACCENTS`/`FONTS`/`LAYOUTS` seeds with a catalog of internally-coherent design systems distilled from researched best practice.

**Files:**
- Create: `server/agent/services/resumeDesignCatalog.js`
- Modify: `server/agent/services/resumeAuthor.js` (replace `ACCENTS/FONTS/LAYOUTS/pick/styleSeed` with catalog use)
- Test: `server/seeds/verifyResumeQuality.js` (extend)

**Interfaces:**
- Produces:
  - `DESIGN_SYSTEMS` → `Array<{ name, vibe, accentHex, neutrals:{ink,muted,line,bg}, headingFont, bodyFont, layout, accentUsage, note }>` (fonts are Google/open-source names).
  - `pickDesignSystem()` → one random entry.
  - `designSystemSeedText(system)` → the steer string injected into the design prompt (replaces `styleSeed()`).

- [ ] **Step 1: Research + author the catalog**

Research authoritative sources (Google Fonts pairing guidance, accessible palette systems, typography pairing references, editorial/resume layout galleries) and distill **12–20** coherent systems. Each entry: a tested heading+body Google-Font pairing, an accent hex with a small neutral ramp (good contrast), one layout archetype (from: `two-column-sidebar`, `single-column-editorial`, `header-band`, `asymmetric-grid`, `slim-right-rail`, `centered-thin-rule`), and an `accentUsage` rule + one-line art-direction `note`. Create `server/agent/services/resumeDesignCatalog.js`:
```js
/**
 * Curated, research-backed resume design systems. Each entry is an INTERNALLY
 * COHERENT combination (palette + Google-Font pairing + layout + accent rules) so the
 * design model composes from a proven quality floor instead of random orthogonal picks.
 * Fonts MUST be Google/open-source family names (resumeFonts embeds them).
 */
const DESIGN_SYSTEMS = [
  {
    name: 'Editorial Serif',
    vibe: 'refined, publication-grade',
    accentHex: '#1e3a8a',
    neutrals: { ink: '#111827', muted: '#4b5563', line: '#e5e7eb', bg: '#ffffff' },
    headingFont: 'Fraunces',
    bodyFont: 'Inter',
    layout: 'single-column-editorial',
    accentUsage: 'accent only on the name, section rules, and link underlines',
    note: 'high-contrast serif display name over a clean sans body; hairline dividers; generous leading',
  },
  // ... 11–19 more entries spanning geometric-sans, technical-mono, two-column-sidebar,
  //     warm-humanist, monochrome-minimal, etc. (authored during this step)
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickDesignSystem = () => pick(DESIGN_SYSTEMS);

function designSystemSeedText(s) {
  return [
    `STYLE SEED (interpret with taste for variety; never mention it in the resume): use the "${s.name}" design system — ${s.vibe}.`,
    `Layout: ${s.layout}. Headings in '${s.headingFont}', body in '${s.bodyFont}' (name them directly in CSS — the system embeds them).`,
    `Accent ${s.accentHex} with neutrals ink ${s.neutrals.ink} / muted ${s.neutrals.muted} / line ${s.neutrals.line} / bg ${s.neutrals.bg}. Accent usage: ${s.accentUsage}.`,
    `Art direction: ${s.note}. Make it look clearly design-led, not a generic template.`,
  ].join('\n');
}

module.exports = { DESIGN_SYSTEMS, pickDesignSystem, designSystemSeedText };
```

- [ ] **Step 2: Add a catalog-shape check**

Append to `server/seeds/verifyResumeQuality.js`:
```js
function checkDesignCatalog() {
  const { DESIGN_SYSTEMS, pickDesignSystem, designSystemSeedText } = require('../agent/services/resumeDesignCatalog');
  assert.ok(DESIGN_SYSTEMS.length >= 12, 'expected >=12 design systems');
  const LAYOUTS = new Set(['two-column-sidebar','single-column-editorial','header-band','asymmetric-grid','slim-right-rail','centered-thin-rule']);
  for (const s of DESIGN_SYSTEMS) {
    assert.ok(s.name && s.headingFont && s.bodyFont, `system ${s.name} missing fonts`);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(s.accentHex), `system ${s.name} bad accent hex`);
    assert.ok(LAYOUTS.has(s.layout), `system ${s.name} unknown layout ${s.layout}`);
  }
  const seed = designSystemSeedText(pickDesignSystem());
  assert.ok(seed.includes('STYLE SEED') && seed.length > 120, 'seed text looks wrong');
  console.log(`OK: design catalog (${DESIGN_SYSTEMS.length} systems)`);
}
checkDesignCatalog();
```

- [ ] **Step 3: Run to verify**

Run: `cd server && node seeds/verifyResumeQuality.js`
Expected: `OK: design catalog (N systems)` with N≥12.

- [ ] **Step 4: Use the catalog in `resumeAuthor.js`**

In `server/agent/services/resumeAuthor.js`: delete the `ACCENTS`, `FONTS`, `LAYOUTS`, `pick`, and `styleSeed` definitions (lines ~92-123). Add near the top: `const { pickDesignSystem, designSystemSeedText } = require('./resumeDesignCatalog');`. In `buildPool`'s `makeProposer`, replace `steer || styleSeed()` with `steer || designSystemSeedText(pickDesignSystem())`.

- [ ] **Step 5: Lint**

Run: `cd server && npx eslint agent/services/resumeAuthor.js`
Expected: no undefined-reference errors for the removed `styleSeed`/`ACCENTS` etc.

- [ ] **Step 6: Commit**

```bash
git add server/agent/services/resumeDesignCatalog.js server/agent/services/resumeAuthor.js server/seeds/verifyResumeQuality.js
git commit -m "feat(resume): researched curated design-system catalog replaces random style seeds"
```

---

### Task 7: Few-shot gold HTML exemplars in the design prompt

Give the design model concrete quality references built to the catalog standard.

**Files:**
- Create: `server/agent/services/resumeExemplars.js`
- Modify: `server/agent/services/resumeAuthor.js` (`designSystemPrompt` to include exemplars)
- Test: render-validation via `server/seeds/verifyResumeQuality.js` (extend) using the existing renderer

**Interfaces:**
- Consumes: `sanitizeResumeHtml` (from resumeAuthor), `renderHtmlDoc` (from resumePdf).
- Produces: `EXEMPLARS` → `string[]` (2–3 complete `<!doctype html>` resume docs); `exemplarBlock()` → a prompt fragment embedding them.

- [ ] **Step 1: Author 2–3 gold exemplars**

Create `server/agent/services/resumeExemplars.js` with 2–3 complete, single-file HTML resumes, each built to a *different* catalog design system, each using realistic placeholder content (a fictional candidate), inline `<style>`, Google-Font family names, no external URLs/scripts, designed to fill one full A4 page. **Minify the HTML/CSS** (these ride along on every proposer + repair call; bloat costs tokens and can overflow reduced-context free variants — confirm prompt + exemplars + 8000-token output fits the chosen design slugs' context window).
```js
/**
 * Hand-crafted gold-standard resume exemplars used as few-shot references in the
 * design prompt. Each is a complete single-file HTML doc at the target quality bar,
 * in a DIFFERENT design system. Content is fictional placeholder data.
 */
const EXEMPLARS = [
  `<!doctype html><html><head><meta charset="utf-8"><style> /* ...full Editorial Serif resume... */ </style></head><body> <!-- ... --> </body></html>`,
  `<!doctype html><html><head><meta charset="utf-8"><style> /* ...full Two-Column Sidebar resume... */ </style></head><body> <!-- ... --> </body></html>`,
];

function exemplarBlock() {
  return [
    'QUALITY REFERENCES — the following are example resumes at the EXACT quality bar to match (different candidates, different design systems). Study their hierarchy, spacing, color discipline, and layout. Produce work at this level, but in YOUR OWN distinct design — do NOT copy their fonts/colors/content.',
    ...EXEMPLARS.map((html, i) => `--- EXAMPLE ${i + 1} ---\n${html}`),
  ].join('\n\n');
}

module.exports = { EXEMPLARS, exemplarBlock };
```

- [ ] **Step 2: Validate each exemplar renders clean, fits, AND scores high**

Few-shot examples teach taste — an ugly-but-fitting exemplar would teach mediocrity. So validate render/fit AND a high vision score (the references must clear the bar they're meant to set). Append to `server/seeds/verifyResumeQuality.js`:
```js
async function checkExemplars() {
  const { EXEMPLARS } = require('../agent/services/resumeExemplars');
  const { sanitizeResumeHtml } = require('../agent/services/resumeAuthor');
  const { renderHtmlDoc } = require('../agent/services/resumePdf');
  const { critiqueDesign } = require('../agent/core/designCritic');
  const { VISUAL_BAR } = require('../agent/core/designCritic');
  assert.ok(EXEMPLARS.length >= 2, 'expected >=2 exemplars');
  for (let i = 0; i < EXEMPLARS.length; i++) {
    const clean = sanitizeResumeHtml(EXEMPLARS[i]);
    const r = await renderHtmlDoc(clean, { measure: true, screenshot: true });
    assert.ok(r.pages >= 1 && r.pages <= 2, `exemplar ${i} must fit 1–2 pages, got ${r.pages}`);
    assert.ok((r.text || '').length > 300, `exemplar ${i} rendered too empty`);
    // Taste gate: the references must themselves clear the design bar (needs vision creds).
    if (r.screenshot) {
      const c = await critiqueDesign(r.screenshot);
      assert.ok(c.score >= VISUAL_BAR && !c.looksGeneric, `exemplar ${i} not good enough (score ${c.score}, generic=${c.looksGeneric}) — redesign it`);
      console.log(`  exemplar ${i}: score ${c.score}, pages ${r.pages}`);
    }
  }
  console.log(`OK: ${EXEMPLARS.length} exemplars render clean, fit, and clear the design bar`);
}
```
(`VISUAL_BAR` is exported from `designCritic.js`. Requires the vision critic creds set — Task 1/5.)
And change the bottom of the script to run async checks:
```js
(async () => {
  // ...existing sync checks already ran above...
  await checkExemplars();
  console.log('\nAll resume-quality checks passed.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```
(Move the sync check calls above the IIFE or call them inside it before `checkExemplars`.)

- [ ] **Step 3: Run to verify**

Run: `cd server && node seeds/verifyResumeQuality.js`
Expected: `OK: N exemplars render clean within 2 pages`. If an exemplar overflows or renders empty, fix its HTML/CSS and re-run until it passes.

- [ ] **Step 4: Inject exemplars into the design prompt**

In `server/agent/services/resumeAuthor.js`, add `const { exemplarBlock } = require('./resumeExemplars');` and append the block to the END of `designSystemPrompt()`'s returned string (after the DESIGN PRINCIPLES section):
```js
'',
exemplarBlock(),
```
(Add as final array elements before `.join('\n')`.)

- [ ] **Step 5: Commit**

```bash
git add server/agent/services/resumeExemplars.js server/agent/services/resumeAuthor.js server/seeds/verifyResumeQuality.js
git commit -m "feat(resume): few-shot gold HTML exemplars in the design prompt"
```

---

### Task 8: Richer grounded content prompts

Strengthen the writing in the content stages without weakening grounding.

**Files:**
- Modify: `server/agent/services/resumeAuthor.js` — system prompts in `contentFromProfile` (~line 320), `expandProjectContent` (~lines 390-400), `summaryFromContent` (~line 452)
- Modify: `server/routes/resumeBuilder.js` — `/generate` system prompt (~line 342)

- [ ] **Step 1: Strengthen `expandProjectContent`**

In its system prompt array, change the per-project rewrite line to require STAR framing + a quantified outcome WHERE THE INPUT SUPPORTS IT, e.g. add these bullets (keep all existing HARD RULES, especially "use ONLY the information given / never invent metrics"):
```js
'For EACH project, rewrite `description` into a concrete 2–3 sentence brief using STAR shape: the problem/context, what they built and the key technical decisions, the tech stack, and the outcome/impact.',
'Prefer concrete, specific phrasing over generic claims. Only state a number/metric if it is already present in the input — never fabricate one; when no metric exists, describe the impact qualitatively.',
```

- [ ] **Step 2: Strengthen `summaryFromContent`**

Change its system prompt to ask for a specific, role-focused summary that names the candidate's strongest tech and project domain (still grounded):
```js
content: 'You write the professional-summary line of a resume. Given the candidate\'s structured resume content (JSON), return ONLY a single plain-text summary of 2–3 sentences (no heading, no quotes, no markdown). Lead with their field/role focus, name their strongest, most relevant technologies and the domain shown by their best projects, and close with the value they bring. Ground it STRICTLY in the provided content — never invent employers, degrees, metrics, or skills not present.'
```

- [ ] **Step 3: Strengthen `contentFromProfile` and `/generate`**

In `contentFromProfile`, add to the system prompt (preserving the grounding sentence and JSON-only output): "Write impactful, specific bullet points using strong action verbs; group skills into Languages / Frameworks / Tools where natural." In `/generate`'s system prompt, change the experience-description rule to: "2–3 sentence improved description using strong action verbs and a quantifiable achievement ONLY if present in the input (never invent numbers)."

- [ ] **Step 4: Lint both files**

Run: `cd server && npx eslint agent/services/resumeAuthor.js routes/resumeBuilder.js`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/agent/services/resumeAuthor.js server/routes/resumeBuilder.js
git commit -m "feat(resume): richer grounded content prompts (STAR + specificity, no fabricated metrics)"
```

---

### Task 9: End-to-end verification

**Files:**
- None modified (observation only)

- [ ] **Step 1: Run the full verify script**

Run: `cd server && node seeds/verifyResumeQuality.js`
Expected: all `OK:` lines + `All resume-quality checks passed.`

- [ ] **Step 2: Generate a real resume end-to-end**

Start the server (`cd server && npm run dev`) and client (`cd client && npm run dev`), sign in as a mentee with a reasonably complete profile + ≥2 projects, run the resume intake to satisfy the gate, and trigger `/author`. Poll the draft until `generationStatus: done`.

- [ ] **Step 3: Inspect `generationMeta`**

In the returned/persisted draft, confirm `generationMeta` shows: `models` = your two OpenRouter slugs, `candidates` = 2, `rounds` ≥ 0, `verified: true`, a `visionScore`, `fillRatio` ≥ the fill floor, `pages` ≤ 2. If `verified` is false or `visionScore` is low/absent, note which (critic creds? model 429 → Groq fallback?) and revisit Task 4/5.

- [ ] **Step 4: Eyeball the output**

Open the rendered resume. Confirm: it looks design-led (not the centered-name/underlined-caps template), fills the page, varies across two regenerations, and contains fuller project descriptions. Regenerate once to confirm a *visibly different* design system is chosen.

- [ ] **Step 5: Confirm legacy routes still work**

Exercise `/generate` (resume content assist) and `/cover-letter`; confirm both return content (now via the OpenRouter content model) with no 404/`model not found`.

- [ ] **Step 6: Final commit (docs)**

```bash
git add docs/superpowers/specs/2026-06-18-resume-quality-upgrade-design.md docs/superpowers/plans/2026-06-18-resume-quality-upgrade.md
git commit -m "docs(resume): quality-upgrade spec + implementation plan"
```

---

## Self-Review

**Spec coverage:**
- Spec A (provider/model plumbing) → Tasks 1–5. ✓
- Spec B (vision critic upgrade) → Task 5 (+ vision model set in Task 1). ✓
- Spec C (curated design catalog / the research idea) → Task 6. ✓
- Spec D (few-shot exemplars) → Task 7. ✓
- Spec E (richer grounded content) → Task 8. ✓
- max_tokens raise → Task 4 Step 4 (8000). ✓
- Groq resilience fallback → Task 4. ✓
- Legacy `/generate` + `/cover-letter` not broken → Tasks 2, 3, 9 Step 5. ✓
- Graceful degradation w/o OpenRouter key → preserved (config defaults fall back to Groq creds; `resumeDesignCandidates` provider detection handles empty base). ✓

**Placeholder scan:** The only intentionally-not-fully-written code is the *content artifacts* that ARE the deliverable of their task — the 12–20 catalog entries (Task 6 Step 1) and the 2–3 full exemplar HTML docs (Task 7 Step 1). Both are bounded by explicit acceptance criteria AND a machine check (shape assertions + Puppeteer render/fit validation) that fails the task until satisfied. All plumbing/logic steps contain complete code.

**Type consistency:** `resumeDesignCandidates()` / `groqDesignFallback()` return `{provider,baseUrl,apiKey,model}` and are consumed that way in `buildPool`. `pickDesignSystem`/`designSystemSeedText` signatures match between catalog and `makeProposer`. `exemplarBlock()` returns a string appended to the prompt array. `contentCompletion` preserves the `{choices:[{message}]}` shape the routes read. Verify script function names are unique.
