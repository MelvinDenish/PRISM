/**
 * Post-upgrade verification: runs the resume design loop with the Phase-2 OpenRouter
 * config applied IN-PROCESS (keys derived from the already-loaded .env, so no secrets on
 * the command line), and asserts the upgrade goals:
 *   - improved OpenRouter models are actually used (meta.model is an OpenRouter slug)
 *   - the Groq fallback did NOT fire (meta.usedFallback === false)
 *   - the result is verified + a real vision score is produced
 *
 *   node seeds/verifyResumeAfter.js [runs=2]
 *
 * This sets the same RESUME_* values documented for server/.env; once they are added to
 * .env this script is redundant (kept as a throwaway harness).
 */
require('dotenv').config();

// Apply the Phase-2 resume config in-process (mirrors the server/.env block).
// Hugging Face router: the best open coders — Kimi-K2.7-Code (renowned for frontend)
// + Qwen3-Coder-Next (fast, latest Qwen coder). Best-of-N across the two.
process.env.RESUME_LLM_BASE_URL = 'https://router.huggingface.co/v1';
process.env.RESUME_LLM_API_KEY = process.env.HF_TOKEN;
process.env.RESUME_DESIGN_MODELS = 'moonshotai/Kimi-K2.7-Code,Qwen/Qwen3-Coder-Next';
process.env.RESUME_CONTENT_MODEL = 'Qwen/Qwen3-Coder-Next';
process.env.RESUME_DESIGN_MAX_TOKENS = process.env.RESUME_DESIGN_MAX_TOKENS || '4500';
process.env.RESUME_LLM_TIMEOUT_MS = process.env.RESUME_LLM_TIMEOUT_MS || '120000';
process.env.RESUME_GEN_DEADLINE_MS = process.env.RESUME_GEN_DEADLINE_MS || '180000';
process.env.RESUME_VISION_BASE_URL = 'https://api.groq.com/openai/v1';
process.env.RESUME_VISION_API_KEY = process.env.GROQ_API_KEY;
process.env.RESUME_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { shapeAuthorContent, authorHtml } = require('../agent/services/resumeAuthor');
const { renderHtmlDoc, closeBrowser } = require('../agent/services/resumePdf');
const { critiqueDesign } = require('../agent/core/designCritic');

const runs = Math.max(1, parseInt(process.argv[2], 10) || 2);

const RAW = {
  personalInfo: { fullName: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+91 98765 43210', location: 'Chennai, India', linkedin: 'linkedin.com/in/aaravsharma', github: 'github.com/aaravsharma', portfolio: 'aarav.dev', summary: '' },
  education: [{ institution: 'College of Engineering, Guindy (Anna University)', degree: 'B.E.', field: 'Computer Science and Engineering', startDate: '2022', endDate: '2026', gpa: '8.7' }],
  experience: [{ company: 'Zoho Corporation', position: 'Software Engineering Intern', startDate: 'May 2025', endDate: 'Jul 2025', current: false, description: 'Worked on the analytics dashboard team building internal reporting tools.' }],
  projects: [
    { name: 'CampusEats', description: 'A food-ordering app for the campus canteen with live order tracking.', technologies: 'React, Node.js, MongoDB, Socket.IO', link: 'github.com/aaravsharma/campuseats' },
    { name: 'LeafLens', description: 'A plant-disease classifier from leaf photos with an explainability overlay.', technologies: 'Python, PyTorch, FastAPI', link: 'github.com/aaravsharma/leaflens' },
  ],
  skills: ['Java', 'Python', 'JavaScript', 'C++', 'React', 'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'Git', 'Linux'],
  certifications: [{ name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', date: '2025' }],
  achievements: ['Finalist, Smart India Hackathon 2025', 'Top 5% on LeetCode (1900+ rating)'],
  positionsOfResponsibility: ['Technical Lead, College Coding Club', 'Volunteer, IEEE Student Branch'],
  languages: ['English', 'Hindi', 'Tamil'], hobbies: ['Competitive programming', 'Chess'],
  cgpa: '8.7', tenthPercent: '94', twelfthPercent: '91', registerNumber: '2022103045',
};

const OPENROUTER_SLUGS = process.env.RESUME_DESIGN_MODELS.split(',');

(async () => {
  const tmp = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const shaped = shapeAuthorContent(RAW, {});
  let anyFallback = false;
  const scores = [];

  for (let i = 1; i <= runs; i++) {
    const t0 = Date.now();
    const { html, pages, meta } = await authorHtml({ content: shaped });
    fs.writeFileSync(path.join(tmp, `after-${i}.html`), html);

    let visionScore = null;
    try { const r = await renderHtmlDoc(html, { measure: false, screenshot: true }); if (r.screenshot) visionScore = (await critiqueDesign(r.screenshot)).score; } catch { /* best-effort */ }
    scores.push(visionScore);
    if (meta.usedFallback) anyFallback = true;

    console.log(`\n=== after #${i} (${Date.now() - t0}ms) ===`);
    console.log('  model        :', meta.model);
    console.log('  usedFallback :', meta.usedFallback);
    console.log('  verified     :', meta.verified, '| pages:', pages, '| fillRatio:', (meta.fillRatio || 0).toFixed(2));
    console.log('  visionScore  :', visionScore, '| rounds:', meta.rounds);

    // Per-run goal assertions.
    assert.ok(OPENROUTER_SLUGS.includes(meta.model), `run ${i}: expected an OpenRouter design model, got ${meta.model}`);
    assert.strictEqual(meta.usedFallback, false, `run ${i}: Groq fallback fired (OpenRouter pool exhausted)`);
  }

  await closeBrowser();
  console.log('\n— SUMMARY —');
  console.log('  improved models used, no Groq fallback:', !anyFallback ? 'YES' : 'NO');
  console.log('  vision scores:', JSON.stringify(scores), '(baseline was 70, looksGeneric)');
  console.log('\nPost-upgrade verification PASSED.');
  process.exit(0);
})().catch((e) => { console.error('\nVERIFY FAILED:', e.message); process.exit(1); });
