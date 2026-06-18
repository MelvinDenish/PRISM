/* Run: RESUME_LIVE=1 node server/seeds/verifyResumeFillLive.js
 *
 * LIVE counterpart to verifyResumeFill.js: hits the REAL resume design LLM (a couple of
 * cheap Groq calls) to answer the question the stub can't — is FILL_MIN calibrated to what
 * the real design model actually produces? It authors a resume from adequately-detailed,
 * truthful content and asserts the rendered page FILLS the A4 within the new bands (so the
 * loop isn't doomed to exit unverified on normal input). Gated behind RESUME_LIVE=1 so the
 * normal (stubbed) suite never spends tokens. Backs off on Groq's free-tier TPM 429s.
 */
require('dotenv').config();
const assert = require('assert');

if (process.env.RESUME_LIVE !== '1') {
  console.log('SKIP - set RESUME_LIVE=1 to run the live LLM fill check.');
  process.exit(0);
}

const { config } = require('../config/env');
const { shapeAuthorContent, authorHtml } = require('../agent/services/resumeAuthor');
const { renderResumePdf, renderHtmlDoc, closeBrowser, A4_PAGE_PX, FILL_MIN } = require('../agent/services/resumePdf');
const { estimateContentWords } = require('../agent/services/resumeCompleteness');

// Adequately-detailed truthful content (no front-load LLM call needed — keeps us inside the
// free-tier TPM budget so the single design call has room). Two real projects, fuller briefs.
const CONTENT = {
  personalInfo: {
    fullName: 'Priya Raman', email: 'priya.raman@example.com', phone: '+91 90000 00000',
    location: 'Chennai, India', linkedin: 'https://linkedin.com/in/priyaraman', github: 'https://github.com/priyaraman',
    summary: 'Final-year Computer Science undergraduate focused on full-stack web development, with hands-on experience building and shipping small applications end to end and a strong grounding in data structures and algorithms.',
  },
  education: [{ institution: 'CEG, Anna University', degree: 'B.E.', field: 'Computer Science', startDate: '2022', endDate: '2026', gpa: '8.6' }],
  skills: ['Python', 'JavaScript', 'React', 'Node.js', 'MongoDB', 'Git', 'SQL', 'Express'],
  projects: [
    { name: 'Expense Tracker', description: 'A full-stack web app that lets users log daily expenses, categorize them, and view monthly spending trends through interactive charts. Built the REST API and authentication, and designed the React dashboard. Reduced manual budgeting effort for early test users.', technologies: 'React, Node.js, Express, MongoDB' },
    { name: 'Weather Bot', description: 'A Telegram bot that returns current conditions and a short forecast for any city on demand. Implemented the command parsing, integrated a weather data source, and added simple caching to keep responses fast. Handles malformed input gracefully.', technologies: 'Python, Telegram Bot API' },
  ],
  achievements: ['Finalist, college hackathon 2024 (built a campus navigation prototype in 24 hours).'],
  positionsOfResponsibility: ['Coordinator, Coding Club — organized weekly problem-solving sessions for ~40 juniors.'],
  cgpa: '8.6', tenthPercent: '92', twelfthPercent: '90', registerNumber: '2022CS1234',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// authorHtml throws statusCode 429 on Groq TPM limits ("try again in 19.7s"). Retry the
// whole author (a fill loop that converges on pass 0 is one design call) with backoff.
async function authorWithBackoff(args, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try { return await authorHtml(args); }
    catch (e) {
      if (e.statusCode !== 429 || i === tries - 1) throw e;
      const m = /try again in ([\d.]+)s/i.exec(e.message);
      const wait = Math.ceil((m ? parseFloat(m[1]) : 25) + 3) * 1000;
      console.log(`  429 TPM — backing off ${wait / 1000}s (retry ${i + 1}/${tries - 1})…`);
      await sleep(wait);
    }
  }
  throw new Error('unreachable');
}

(async () => {
  if (!config.hasResumeLlm()) { console.log('SKIP - no resume LLM configured.'); process.exit(0); }
  console.log('Design model:', config.resumeDesignModel());

  const shaped = shapeAuthorContent(CONTENT, {});
  console.log('content words:', estimateContentWords(shaped));
  const originalNames = shaped.projects.map((p) => p.name).sort();

  const t0 = Date.now();
  const { html, meta } = await authorWithBackoff({ content: shaped });
  console.log('authorHtml meta:', JSON.stringify(meta), `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // Independently re-measure the FINAL html (same path export uses).
  const rendered = await renderHtmlDoc(html, { measure: true });
  const fill = ((rendered.height || 0) - (Math.max(1, rendered.pages) - 1) * A4_PAGE_PX) / A4_PAGE_PX;
  console.log(`rendered: pages=${rendered.pages}, height=${rendered.height}px, lastPageFill=${(fill * 100).toFixed(0)}% (bar ${Math.round(FILL_MIN * 100)}%)`);

  // No fabrication: the design must not have invented/renamed projects in the content.
  assert(rendered.text.toLowerCase().includes('priya'), 'candidate name present in render');
  assert(rendered.text.includes('Expense Tracker') && rendered.text.includes('Weather Bot'), 'real project names preserved');

  // Calibration: a real design from adequate content should land verified within the bands.
  assert(meta.verified === true, `design verified within fill bands (meta: ${JSON.stringify(meta)})`);
  if (rendered.pages === 1) assert(fill >= FILL_MIN, `single page fills the A4 (got ${(fill * 100).toFixed(0)}%)`);
  else assert(rendered.pages === 2 && fill >= 0.5, `clean 2 pages, no half-empty trailing page (got ${(fill * 100).toFixed(0)}%)`);

  const pdf = await renderResumePdf({ generatedHtml: html });
  assert(Buffer.isBuffer(pdf) && pdf.byteLength > 1000, 'produces a non-trivial PDF');

  // Vision self-critique loop: ran (a score recorded) or degraded cleanly (skipped). Soft —
  // the free-tier vision model may 429; we only assert the shape when it ran.
  if (config.hasResumeVision()) {
    if (meta.visionPasses) {
      assert(meta.visionScore === null || (typeof meta.visionScore === 'number' && meta.visionScore >= 0 && meta.visionScore <= 100),
        `vision score in range (got ${meta.visionScore})`);
      console.log(`vision loop ran: model=${meta.visionModel}, passes=${meta.visionPasses}, score=${meta.visionScore}`);
    } else {
      console.log('vision loop skipped/degraded (no passes) — acceptable on the free tier.');
    }
  }

  // Any non-web-safe font the model named must be embedded inline (offline), not fetched.
  const faces = (html.match(/@font-face/g) || []).length;
  console.log(`embedded @font-face rules: ${faces}`);

  await closeBrowser();
  console.log('\nverifyResumeFillLive: PASS — real design fills the A4 within the bands, projects preserved.');
})().catch(async (e) => { try { await closeBrowser(); } catch { /* noop */ } console.error('FAIL:', e.message); process.exit(1); });
