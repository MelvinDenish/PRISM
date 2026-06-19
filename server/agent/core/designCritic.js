/**
 * Design Critique Agent — the dedicated, reusable critic for AI-authored resumes.
 *
 * Combines the TWO ground-truth signals into one verdict that drives refineLoop's
 * keepBest / early-exit:
 *   • Structural (deterministic): render headless OFFLINE and measure real A4 fit
 *     (≤2 pages, never half-empty), candidate-name presence, non-empty — verifyRender.
 *   • Visual (multimodal): screenshot the render and ask the vision model
 *     (llama-4-scout, Groq / PII-safe) to score professional design + return concrete,
 *     actionable fixes — critiqueDesign.
 *
 * verifyDesign() returns { pass, score, feedback, meta } for refineLoop:
 *   - score encodes SHIPPABILITY: structural failures score NEGATIVE (any valid
 *     candidate beats any broken one); a "looks generic" penalty is folded INTO the
 *     visual score so keepBest can never rank a generic-but-high render above a clean
 *     one (and so the early-exit `pass` and the kept-best agree).
 *   - feedback is the structural problem (if broken) or the vision fixes (if valid) —
 *     the FRESH steer refineLoop feeds to the next repair round.
 *
 * Graceful degradation: no / failed vision → structural-only pass (mirrors the prior
 * pipeline; generation never blocks on the critic).
 *
 * verifyRender + critiqueDesign live here (the single source of truth for "what makes
 * a good resume design") and are re-exported by resumeAuthor.js for back-compat.
 */
const { renderHtmlDoc, A4_PAGE_PX, FILL_MIN, TRAILING_MIN } = require('../services/resumePdf');
const llm = require('../llm');
const { config } = require('../../config/env');

const str = (v) => (v == null ? '' : String(v));

// Renders below this visual score (or flagged generic) are sent back for one more
// improvement round. GENERIC_PENALTY is folded into the score so a "generic" render
// can't win keepBest over a non-generic one with a slightly lower raw vision score.
const VISUAL_BAR = 82;
const GENERIC_PENALTY = 25;

// ── Structural verifier (deterministic) ──────────────────────────────────────
// Verify a rendered resume against the "full A4, never half-empty" bar. Returns
// { ok, kind, problem, fillRatio } — `problem` feeds the repair pass, `kind` lets the
// caller branch/telemeter, `fillRatio` is the LAST page's fullness (0–1). The metrics
// use the TRUE content height (min-heights neutralized by renderHtmlDoc), so a design
// that pads itself with min-height:100vh can't masquerade as a full page.
function verifyRender({ pages, text, height }, content) {
  const t = (text || '').trim();
  const pageN = Math.max(1, pages || 1);
  const fill = ((Number(height) || 0) - (pageN - 1) * A4_PAGE_PX) / A4_PAGE_PX;
  const fillRatio = Math.max(0, Math.min(1, fill));
  const pct = Math.round(fillRatio * 100);

  if (t.length < 120) return { ok: false, kind: 'empty', fillRatio, problem: 'The resume rendered almost empty. Re-author it using all the provided content.' };
  const name = str(content?.personalInfo?.fullName).trim();
  if (name && !t.toLowerCase().includes(name.toLowerCase().split(/\s+/)[0])) {
    return { ok: false, kind: 'name', fillRatio, problem: 'The candidate name is missing from the header. Add a clear header with the full name.' };
  }
  if (pageN > 2) {
    return { ok: false, kind: 'overflow', fillRatio, problem: `The resume overflowed to ${pageN} pages. Make it fit within 2 A4 pages by tightening spacing, font sizes, and wording — prefer 1 page.` };
  }
  if (pageN === 2 && fill < TRAILING_MIN) {
    return { ok: false, kind: 'partial', fillRatio, problem: `The resume spills onto a second page that is only ${pct}% full, which looks unfinished. WITHOUT removing real information, tighten spacing, font sizes, and wording so it fits on a single full A4 page.` };
  }
  if (pageN === 1 && fill < FILL_MIN) {
    return { ok: false, kind: 'underfull', fillRatio, problem: `The resume only fills ${pct}% of the A4 page, leaving it half-empty. WITHOUT inventing any new facts (no new employers, projects, dates, or metrics), fill one full A4 page: expand the existing project and experience briefs into fuller 2–3 sentence descriptions, use comfortable line spacing and slightly larger, readable type, and space the sections to fill the whole page.` };
  }
  return { ok: true, kind: 'ok', fillRatio };
}

// ── Visual critic (multimodal) ───────────────────────────────────────────────
function visionCriticMessages(pngBase64) {
  const rubric = [
    'You are a senior design director reviewing a RENDERED resume (image attached). Judge ONLY its visual design, not the wording.',
    'Score 0–100 on: typographic hierarchy & font choice, alignment/grid, whitespace rhythm & balance, color discipline, and overall "does this look professionally designed (a studio piece) or like a generic template?".',
    'Be demanding: a plain centered name with underlined ALL-CAPS section titles and default-looking type scores LOW (≤60). A distinctive, well-composed, well-spaced layout scores HIGH.',
    'Return ONLY JSON: {"score": <0-100>, "looksGeneric": <true|false>, "fixes": ["specific actionable visual fix", ...]} — 2–5 concrete fixes (e.g. "increase the name to ~30px with letter-spacing", "move skills into a left sidebar", "tighten section gaps to ~14px", "use the accent only on section titles"). No prose outside the JSON.',
  ].join('\n');
  return [{
    role: 'user',
    content: [
      { type: 'text', text: rubric },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } },
    ],
  }];
}

/** Ask the vision model to score a rendered screenshot. Throws on failure (caller decides). */
async function critiqueDesign(screenshotBuf) {
  const message = await llm.chat({
    baseUrl: config.resumeVisionBaseUrl(),
    apiKey: config.resumeVisionApiKey(),
    model: config.resumeVisionModel(),
    temperature: 0.2,
    max_tokens: 500,
    messages: visionCriticMessages(screenshotBuf.toString('base64')),
  });
  const raw = (message.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const m = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : raw);
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    looksGeneric: !!parsed.looksGeneric,
    fixes: Array.isArray(parsed.fixes) ? parsed.fixes.map(str).filter(Boolean).slice(0, 6) : [],
  };
}

// ── Combined verdict for refineLoop ──────────────────────────────────────────
/**
 * Render → structural verify → (optional) vision critique → one { pass, score,
 * feedback, meta } verdict. See file header for the scoring contract.
 * @param {{ inlined:string, content:object, useVision?:boolean }} p
 */
async function verifyDesign({ inlined, content, useVision = true }) {
  let rendered;
  try {
    rendered = await renderHtmlDoc(inlined, { measure: true, screenshot: useVision });
  } catch (err) {
    return { pass: false, score: -1000, feedback: `Rendering failed (${err.message}). Produce clean, valid HTML.`, meta: { renderError: true } };
  }

  const structural = verifyRender(rendered, content);
  const baseMeta = { pages: rendered.pages, fillRatio: structural.fillRatio, structuralOk: structural.ok, structuralKind: structural.kind };

  // Structural failure dominates — not shippable. Negative score keeps any valid
  // candidate strictly ahead in keepBest; fillRatio nudges among broken ones.
  if (!structural.ok) {
    return { pass: false, score: -100 + (structural.fillRatio || 0) * 10, feedback: structural.problem, meta: baseMeta };
  }

  // Structurally OK but vision off/unavailable → that IS the bar. Flat baseline so
  // best-of-N has no visual discriminator here (callers use N=1 when !useVision).
  if (!useVision || !rendered.screenshot) {
    return { pass: true, score: 70 + (structural.fillRatio || 0) * 5, feedback: '', meta: { ...baseMeta, vision: 'off' } };
  }

  let critique;
  try { critique = await critiqueDesign(rendered.screenshot); }
  catch { return { pass: true, score: 70 + (structural.fillRatio || 0) * 5, feedback: '', meta: { ...baseMeta, vision: 'unavailable' } }; }

  const effective = critique.score - (critique.looksGeneric ? GENERIC_PENALTY : 0);
  const pass = critique.score >= VISUAL_BAR && !critique.looksGeneric;
  const feedback = critique.fixes && critique.fixes.length ? `DESIGN FIXES:\n- ${critique.fixes.join('\n- ')}` : '';
  return {
    pass,
    score: effective,
    feedback,
    meta: { ...baseMeta, visionScore: critique.score, looksGeneric: critique.looksGeneric, fixes: critique.fixes },
  };
}

module.exports = { verifyRender, critiqueDesign, verifyDesign, VISUAL_BAR };
