# Resume Quality Upgrade — Design Spec

**Date:** 2026-06-18
**Status:** Draft for review
**Branch:** feat/agentic-multimodel-free-tier

## Problem

The AI-authored resume (`/api/resume-builder/author` → `authorHtml`) produces output the
user judges **boring, thin on content, and not professional enough** in design. The
generator is sophisticated (best-of-N + vision-critic refine loop + style seeds), yet
still converges on generic-looking, under-filled resumes.

## Baseline (pre-upgrade, 2026-06-18)

Measured via `server/seeds/captureResumeBaseline.js` on a complete fictional CS-student
fixture: **visionScore 70, looksGeneric: true, 2 pages only ~18% full, verified: false,
rounds: 0** (the self-heal repair bailed; the dead kimi proposer collapsed best-of-N).
This is the bar the upgrade must beat (target: ≥VISUAL_BAR, not generic, 1 full A4 page,
verified true).

## Root-cause findings (from the current code + config)

1. **Best-of-N has silently collapsed.** `config.resumeDesignModels()`
   ([env.js:194](../../../server/config/env.js)) defaults to
   `['openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile']`.
   `moonshotai/kimi-k2-instruct` was **deprecated on Groq (2026-03-23)** and now errors
   or routes back to gpt-oss — so the "two diverging proposers" are effectively one
   model. No divergence → generic, repetitive look.
2. **The privacy-safe Groq path is already on Groq's top free model.** gpt-oss-120b is
   what Groq itself points users to. The genuinely better *aesthetic* frontend models
   (Kimi K2-0905, Qwen3-Coder, DeepSeek V4) now live **off Groq** (OpenRouter). The user
   has explicitly accepted the privacy tradeoff in exchange for quality.
3. **Weak vision judge.** The critic is `llama-4-scout-17b`
   ([designCritic.js](../../../server/agent/core/designCritic.js)) holding `VISUAL_BAR=82`.
   A small judge rubber-stamps mediocre designs, so best-of-N has no real compass.
4. **`max_tokens: 4200`** ([resumeAuthor.js:239](../../../server/agent/services/resumeAuthor.js))
   can truncate a rich two-column HTML+CSS document → sparse/broken render → "not enough".
5. **Design prompt is 100% abstract instructions, 0 examples.** Few-shot exemplars are
   the strongest known lever against "generic" — currently absent.
6. **Style seeds are random and orthogonal.** `ACCENTS`/`FONTS`/`LAYOUTS` are picked
   independently, so combinations can clash and there is no curated quality floor.

## Decision: pursue maximum quality, privacy not a constraint

User directive: *"I wanted best design and best content generation for the resume."*
Operational tradeoffs (OpenRouter free-tier rate limits/latency; off-Groq data handling)
are explicitly accepted. Keep Groq wired as a **fallback tier** so generation never
hard-fails when an OpenRouter free model is rate-limited.

## Goals

- Restore real best-of-N divergence with the strongest free design models.
- Make the critic a competent judge so selection actually rewards beautiful designs.
- Give the design model concrete quality references (few-shot) + a curated,
  research-backed design vocabulary (themes) instead of random seeds.
- Make grounded content fuller and more impactful (STAR + quantified, never invented).
- Stop truncation.

## Non-goals

- No live per-generation web research (latency/rate-limit/trust). Research is build-time.
- No change to the completeness gate / CUIC rules / export pipeline.
- No new always-on dependency; reuse the existing OpenRouter/Gemini/Groq keys.

## Architecture changes

### A. Provider & model plumbing (the enabling refactor)

Today the resume design stage, content stage, and vision critic all share one
`resumeLlmBaseUrl`/`resumeLlmApiKey`, and `piiPool()` reuses that same baseUrl with
**Groq-style model IDs** — so naively pointing `RESUME_LLM_*` at OpenRouter would send
`llama-3.3-70b-versatile` to OpenRouter (invalid slug) and break `/generate` +
`/cover-letter`.

Change:
- Introduce a **multi-provider design pool**: each design-pool entry carries its own
  `{ provider, baseUrl, apiKey, model }` (mirrors the `fastPool`/`piiPool` candidate
  shape). Best-of-N can then span providers (e.g. Kimi K2 + Qwen3-Coder on OpenRouter)
  with **a Groq gpt-oss-120b candidate appended as the resilience fallback**.
- Decouple `piiPool()` from `resumeLlmBaseUrl` so `/generate` + `/cover-letter` keep
  working with explicit Groq creds + Groq model IDs (no behavior change there unless we
  also opt those routes into the better content model — see E).
- The vision critic gets its **own** `{ baseUrl, apiKey, model }` resolution so it can
  use an OpenRouter vision model independent of where design runs.
- New env (with sensible defaults; exact `:free` slugs resolved at build time since they
  rotate): `RESUME_DESIGN_PROVIDER`, `RESUME_DESIGN_MODELS` (OpenRouter slugs),
  `RESUME_CONTENT_MODEL`, `RESUME_VISION_MODEL`, plus the existing
  `RESUME_LLM_BASE_URL`/`RESUME_LLM_API_KEY` and `OPENROUTER_API_KEY` reuse.
- Raise design-stage `max_tokens` to ~8000 (the target models have 128k–256k context).

### B. Vision critic upgrade

- Point the critic at a 70B-class free vision model (`meta-llama/llama-4-maverick:free`
  or `qwen/qwen2.5-vl-72b-instruct:free`) via the critic's own creds.
- Keep the graceful-degradation contract: any critic failure → structural-only pass.
- Re-tune `VISUAL_BAR`/`GENERIC_PENALTY` only if the new judge's score distribution
  warrants it (decide empirically after first runs).

### C. Curated design catalog (the "research the best designs" idea)

New module `server/agent/services/resumeDesignCatalog.js`: an array of vetted, internally
**coherent design systems**, each = `{ name, palette (accent + neutrals, hex), heading
font, body font (Google/open-source names so resumeFonts embeds them), layout archetype,
accent-usage rules, one-line art-direction note }`.

Built by **one-time research-and-distill** of authoritative sources (Google Fonts pairing
guidance, established palette systems with accessible contrast, typography pairing
references, resume/editorial layout galleries). ~12–20 entries spanning serif-display,
geometric-sans, editorial, technical-mono, etc.

`styleSeed()` is replaced by `pickDesignSystem()` which selects a **whole coherent system**
(not orthogonal random picks). Divergence across best-of-N + Regenerate comes from
selecting different catalog entries. Optional future: a re-runnable refresh script
(out of scope now).

### D. Few-shot exemplars

New module `server/agent/services/resumeExemplars.js`: 2–3 **complete, hand-crafted gold
HTML resume documents**, each built to a different catalog design system, each validated
through `sanitizeResumeHtml` + `renderHtmlDoc` to confirm ≤2 pages / full A4 / clean
render. Injected into `designSystemPrompt()` as concrete "this is the quality bar; produce
something at this level in a DIFFERENT style" references.

### E. Richer grounded content

- Strengthen the content prompts (`contentFromProfile`, `expandProjectContent`,
  `summaryFromContent`, and the `/generate` route prompt): STAR framing + quantified
  impact + role-tailored keywording, while keeping the **hard grounding rule** (never
  invent employers/dates/metrics/links).
- Point resume content at the stronger writer model (DeepSeek V4 / Qwen3) via the
  decoupled content creds.
- Keep the completeness gate and `expandProjectContent` fill loop intact.

## Data flow (unchanged shape, upgraded internals)

intake → completeness gate → `shapeAuthorContent` → (background) `authorHtml`
[ proposers pick distinct catalog systems → draft HTML (few-shot prompt) → sanitize +
inline fonts → render → structural verify + stronger vision critic → keepBest → bounded
repair ] → persist draft → client polls.

## Error handling

- Every OpenRouter design/content/vision call falls back: design pool ends with a Groq
  candidate; critic failure → structural-only; content model failure → existing 502/503
  paths. No new hard-fail surfaces. 429 from OpenRouter free tier → failover to next
  candidate (existing `chatWithFailover` semantics, extended to the design pool).

## Testing / verification

- No test runner in repo. Verify via the existing seed/verify scripts pattern + a manual
  end-to-end: generate a resume, inspect `generationMeta` (`models`, `candidates`,
  `rounds`, `verified`, `visionScore`, `fillRatio`, `pages`), and eyeball the rendered
  output for variety + fullness + professionalism. Confirm `/generate` + `/cover-letter`
  still work after the piiPool decoupling.

## Rollout

Env-driven: if `OPENROUTER_API_KEY` is unset the pipeline degrades to the current
Groq-only behavior (so nothing breaks for a deployment without the key). The user's
deployment has the key set.
