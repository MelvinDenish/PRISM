/* Run: node server/seeds/verifyResumeFill.js   (no DB needed; llm.chat is stubbed)
 *
 * Covers the "always fill a full A4" guarantee:
 *   • verifyRender fill bands — underfull / partial(2-page) / overflow / empty / name,
 *     and a genuinely-full single page passing (pure, synthetic metrics — always runs).
 *   • renderHtmlDoc measurement fix — a min-height:100vh near-empty page must read as
 *     SMALL content height (not a full viewport), else the underfull check never fires.
 *   • authorHtml loop — an underfull first pass is repaired (via the repair path) into a
 *     full page, returning verified:true with fillRatio in the band. (Both render checks
 *     need a headless Chrome; they SKIP gracefully if one can't launch here.)
 */
const assert = require('assert');
// hasResumeLlm() reads env at call-time — a dummy key lets authorHtml proceed; the real
// LLM call is stubbed below so the value is never used.
delete process.env.LLM_BASE_URL;
process.env.GROQ_API_KEY = 'test-key-not-used';

const llm = require('../agent/llm');
const { verifyRender, authorHtml } = require('../agent/services/resumeAuthor');
const { renderHtmlDoc, closeBrowser, A4_PAGE_PX, FILL_MIN, TRAILING_MIN } = require('../agent/services/resumePdf');

let passed = 0; const ok = (l) => { passed += 1; console.log('  ok -', l); };
const CONTENT = { personalInfo: { fullName: 'Test Candidate' } };
const TXT = `Test Candidate ${'lorem ipsum dolor sit amet '.repeat(10)}`; // >120 chars, has "test"
const pagesFor = (h) => Math.max(1, Math.ceil(h / A4_PAGE_PX));

(async () => {
  // ── 1. verifyRender fill bands (synthetic metrics — the deterministic core) ──
  const full = verifyRender({ pages: pagesFor(1080), text: TXT, height: 1080 }, CONTENT);
  assert(full.ok && full.kind === 'ok', 'a ~96%-full single page passes');
  assert(full.fillRatio >= FILL_MIN, 'fillRatio reported above the bar');

  const under = verifyRender({ pages: pagesFor(600), text: TXT, height: 600 }, CONTENT);
  assert(!under.ok && under.kind === 'underfull', 'a half-empty single page is flagged underfull');

  const partial = verifyRender({ pages: pagesFor(1200), text: TXT, height: 1200 }, CONTENT);
  assert(!partial.ok && partial.kind === 'partial', 'a near-empty 2nd page is flagged partial');

  const twoFull = verifyRender({ pages: pagesFor(1800), text: TXT, height: 1800 }, CONTENT);
  assert(twoFull.ok && twoFull.kind === 'ok', 'a genuinely 1.6-page resume (clean 2nd page) passes');

  const over = verifyRender({ pages: pagesFor(2600), text: TXT, height: 2600 }, CONTENT);
  assert(!over.ok && over.kind === 'overflow', '3+ pages is flagged overflow');

  const empty = verifyRender({ pages: 1, text: '', height: 1080 }, CONTENT);
  assert(!empty.ok && empty.kind === 'empty', 'empty render is flagged');

  const noName = verifyRender({ pages: 1, text: 'lorem ipsum '.repeat(20), height: 1080 }, CONTENT);
  assert(!noName.ok && noName.kind === 'name', 'missing candidate name is flagged');
  ok('verifyRender fill bands (underfull / partial / overflow / empty / name / full-pass)');

  // ── 2. Measurement fix: min-height:100vh must NOT masquerade as a full page ──
  let browserOk = true;
  try {
    const SPARSE = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
      + '<div style="min-height:100vh"><h1>Test Candidate</h1>'
      + `<p>${'a tiny line of text. '.repeat(8)}</p></div></body></html>`;
    const r = await renderHtmlDoc(SPARSE, { measure: true });
    // With the min-height neutralized for measurement, true content height is small —
    // well under one page and under the fill bar — so underfull is detectable.
    assert(r.height < FILL_MIN * A4_PAGE_PX, `near-empty page measures small (got ${r.height}px, < ${Math.round(FILL_MIN * A4_PAGE_PX)})`);
    assert(r.pages === 1, 'near-empty page is one page');
    ok(`measurement fix: min-height:100vh near-empty page reads ${r.height}px (not a full viewport)`);

    const TALL = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
      + '<h1>Test Candidate</h1><div style="height:980px"></div>'
      + `<p>${'filled content line. '.repeat(8)}</p></body></html>`;
    const r2 = await renderHtmlDoc(TALL, { measure: true });
    assert(r2.height >= FILL_MIN * A4_PAGE_PX && r2.pages === 1, `a genuinely full page measures ~full (got ${r2.height}px, pages=${r2.pages})`);
    ok('measurement fix: a content-tall page reads as a full single page');
  } catch (e) {
    if (/Could not find|Failed to launch|Browser was not found|spawn|executablePath/i.test(e.message)) {
      console.log('  SKIP - headless Chrome unavailable here:', e.message.split('\n')[0]);
      browserOk = false;
    } else { throw e; }
  }

  // ── 3. authorHtml loop: an underfull first pass is repaired into a full page ──
  if (browserOk) {
    let call = 0;
    const longLine = 'Aspiring software engineer with hands-on project experience building applications and learning modern technologies.';
    llm.chat = async () => {
      call += 1;
      if (call === 1) {
        // First pass: min-height:100vh wrapper around a tiny body → underfull once measured.
        return { role: 'assistant', content:
          '<!doctype html><html><head><meta charset="utf-8"></head><body>'
          + `<div style="min-height:100vh"><h1>Test Candidate</h1><p>${longLine}</p></div></body></html>` };
      }
      // Repair pass: content tall enough to fill one A4 (kept safely under 1123px).
      return { role: 'assistant', content:
        '<!doctype html><html><head><meta charset="utf-8"></head><body>'
        + `<h1>Test Candidate</h1><div style="height:920px"></div><p>${longLine}</p></body></html>` };
    };
    const out = await authorHtml({ content: CONTENT, vision: false }); // fill loop only
    assert(call >= 2, 'the underfull first pass triggered at least one repair');
    assert(out.meta.verified === true, 'the loop converged to a verified full page');
    assert(out.meta.fillRatio >= FILL_MIN, `final fillRatio fills the A4 (got ${out.meta.fillRatio.toFixed(2)})`);
    assert(out.meta.repairs >= 1, 'repair count reflects the underfull fix');
    ok(`authorHtml loop repaired underfull → full (repairs=${out.meta.repairs}, fill=${out.meta.fillRatio.toFixed(2)})`);
  }

  // ── 4. Vision self-critique loop: a structurally-good page is scored & accepted ──
  if (browserOk) {
    const longLine = 'Aspiring software engineer with hands-on project experience building applications and learning modern technologies.';
    // Design call returns a full A4 page; the vision call (array content w/ image) returns JSON.
    llm.chat = async ({ messages }) => {
      const isVision = messages.some((m) => Array.isArray(m.content));
      if (isVision) return { role: 'assistant', content: '{"score": 93, "looksGeneric": false, "fixes": []}' };
      return { role: 'assistant', content:
        '<!doctype html><html><head><meta charset="utf-8"></head><body>'
        + `<h1>Test Candidate</h1><div style="height:920px"></div><p>${longLine}</p></body></html>` };
    };
    const out = await authorHtml({ content: CONTENT, vision: true });
    assert(out.meta.verified === true, 'structurally verified by the design critic');
    assert(out.meta.candidates === 2, `best-of-N drafted multiple candidates (got ${out.meta.candidates})`);
    assert(out.meta.visionScore === 93, `vision score recorded (got ${out.meta.visionScore})`);
    ok(`design critic scored & accepted a clean render (score=${out.meta.visionScore}, candidates=${out.meta.candidates})`);

    // Graceful degradation: if the vision call throws, generation still returns the html.
    llm.chat = async ({ messages }) => {
      const isVision = messages.some((m) => Array.isArray(m.content));
      if (isVision) { const e = new Error('429 rate limit'); e.status = 429; throw e; }
      return { role: 'assistant', content:
        '<!doctype html><html><head><meta charset="utf-8"></head><body>'
        + `<h1>Test Candidate</h1><div style="height:920px"></div><p>${longLine}</p></body></html>` };
    };
    const out2 = await authorHtml({ content: CONTENT, vision: true });
    assert(out2.meta.verified === true && out2.html.includes('Test Candidate'), 'vision failure degrades gracefully (html still returned)');
    ok('vision loop degrades gracefully on a 429 (best-effort, never blocks)');
  }

  await closeBrowser();
  console.log(`\nverifyResumeFill: ${passed} checks passed${browserOk ? '' : ' (render checks skipped)'}`);
})().catch(async (e) => { try { await closeBrowser(); } catch { /* noop */ } console.error('FAIL:', e.message); process.exit(1); });
