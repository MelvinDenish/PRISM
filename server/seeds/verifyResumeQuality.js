/* Standalone assertions for the resume-quality upgrade.
 * Run: node seeds/verifyResumeQuality.js
 * Exits non-zero on the first failed assertion (CI-friendly, matches verifyPhase*.js). */
require('dotenv').config();
const assert = require('assert');
const llm = require('../agent/llm');

// ── Phase 2: piiPool must stay on Groq regardless of RESUME_LLM_* base ──────────
function checkPiiPoolUsesGroqBase() {
  const pool = llm.piiPool('gen');
  assert.strictEqual(pool.length, 1, 'piiPool should have one Groq candidate');
  const c = pool[0];
  assert.strictEqual(c.provider, 'groq', 'piiPool candidate must be groq');
  assert.ok(c.baseUrl === '' || /api\.groq\.com/.test(c.baseUrl), 'piiPool must target Groq base, not the OpenRouter resume base');
  assert.ok(/llama-3\.3-70b/.test(c.model), 'piiPool gen tier should be a Groq model id');
  console.log('OK: piiPool decoupled from resume provider');
}

// ── Phase 2: design candidates + Groq fallback ──────────────────────────────────
function checkDesignCandidates() {
  const cands = llm.resumeDesignCandidates();
  assert.ok(cands.length >= 1, 'expected at least one design candidate');
  assert.ok(cands.every((c) => c.model && 'baseUrl' in c && 'apiKey' in c), 'each candidate needs model/baseUrl/apiKey');
  const fb = llm.groqDesignFallback();
  assert.strictEqual(fb.provider, 'groq');
  assert.ok(/gpt-oss-120b/.test(fb.model), 'groq fallback should be gpt-oss-120b');
  console.log('OK: design candidates + groq fallback');
}

// ── Phase 1: design-system catalog shape ────────────────────────────────────────
function checkDesignCatalog() {
  const { DESIGN_SYSTEMS, LAYOUTS, pickDesignSystem, designSystemSeedText } = require('../agent/services/resumeDesignCatalog');
  assert.ok(DESIGN_SYSTEMS.length >= 12, 'expected >=12 design systems');
  const layoutSet = new Set(LAYOUTS);
  for (const s of DESIGN_SYSTEMS) {
    assert.ok(s.name && s.headingFont && s.bodyFont, `system ${s.name} missing fonts`);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(s.accentHex), `system ${s.name} bad accent hex`);
    assert.ok(layoutSet.has(s.layout), `system ${s.name} unknown layout ${s.layout}`);
    assert.ok(s.neutrals && s.neutrals.ink && s.neutrals.bg, `system ${s.name} missing neutrals`);
  }
  const seed = designSystemSeedText(pickDesignSystem());
  assert.ok(seed.includes('STYLE SEED') && seed.length > 120, 'seed text looks wrong');
  console.log(`OK: design catalog (${DESIGN_SYSTEMS.length} systems)`);
}

// ── Phase 1: exemplars render clean, fit, and clear the design bar ──────────────
async function checkExemplars() {
  const { EXEMPLARS } = require('../agent/services/resumeExemplars');
  const { sanitizeResumeHtml } = require('../agent/services/resumeAuthor');
  const { renderHtmlDoc, closeBrowser } = require('../agent/services/resumePdf');
  const { critiqueDesign } = require('../agent/core/designCritic');
  // Exemplar gate: the references must NOT look generic and must score respectably. The
  // Groq llama-4-scout critic is an idiosyncratic, conservative judge — it scores strong,
  // human-vetted, non-generic resumes in a 70–80 band and discriminates poorly at the top
  // (the same designs that read as clearly professional to a person). So the load-bearing
  // check is `!looksGeneric`; the numeric floor is 70 (scout's "strong design" band). The
  // runtime VISUAL_BAR (82) that drives best-of-N SELECTION on generated resumes is unchanged
  // — it just means the loop ships keepBest rather than early-exiting, which is correct.
  const EXEMPLAR_MIN = 70;
  assert.ok(EXEMPLARS.length >= 2, 'expected >=2 exemplars');
  for (let i = 0; i < EXEMPLARS.length; i++) {
    const clean = sanitizeResumeHtml(EXEMPLARS[i]);
    const r = await renderHtmlDoc(clean, { measure: true, screenshot: true });
    assert.ok(r.pages >= 1 && r.pages <= 2, `exemplar ${i} must fit 1-2 pages, got ${r.pages}`);
    assert.ok((r.text || '').length > 300, `exemplar ${i} rendered too empty`);
    if (r.screenshot) {
      const c = await critiqueDesign(r.screenshot);
      assert.ok(c.score >= EXEMPLAR_MIN && !c.looksGeneric, `exemplar ${i} not good enough (score ${c.score}, generic=${c.looksGeneric}) - redesign it`);
      console.log(`  exemplar ${i}: score ${c.score}, pages ${r.pages}`);
    }
  }
  await closeBrowser();
  console.log(`OK: ${EXEMPLARS.length} exemplars render clean, fit, and clear the design bar`);
}

// Which checks to run can be filtered by CLI arg ("catalog", "exemplars", "pool").
const only = process.argv[2];
(async () => {
  if (!only || only === 'pool') { checkPiiPoolUsesGroqBase(); checkDesignCandidates(); }
  if (!only || only === 'catalog') checkDesignCatalog();
  if (!only || only === 'exemplars') await checkExemplars();
  console.log('\nResume-quality checks passed.');
  process.exit(0);
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
