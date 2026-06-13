/* Headless verification for the resume PDF renderer. Run: node server/seeds/verifyResumePdf.js
   Requires Chromium (installed by puppeteer). No DB needed. */
const assert = require('assert');
const { resumeHtml, renderResumePdf, closeBrowser } = require('../agent/services/resumePdf');
const { DEFAULT_DESIGN } = require('../agent/services/resumeDesign');

const sampleDraft = {
  design: DEFAULT_DESIGN,
  personalInfo: { fullName: 'Asha Rao', email: 'asha@example.com', phone: '555-0100', location: 'Bengaluru', summary: 'Backend engineer with 4 years building payment systems.' },
  skills: ['Java', 'Spring', 'PostgreSQL', 'Kafka'],
  experience: [{ company: 'PayCo', position: 'SWE II', startDate: '2022', endDate: '', current: true, description: 'Cut checkout latency 38% by redesigning the settlement pipeline.' }],
  education: [{ institution: 'IISc', degree: 'B.Tech', field: 'CSE', startDate: '2016', endDate: '2020', gpa: '8.6' }],
  projects: [{ name: 'OpenLedger', description: 'A double-entry ledger lib.', technologies: 'Go, SQLite' }],
};

(async () => {
  // HTML emitter: includes name + a section heading + escapes nothing dangerous.
  const html = resumeHtml(DEFAULT_DESIGN, sampleDraft);
  assert(/Asha Rao/.test(html), 'html contains the name');
  assert(/Experience/i.test(html), 'html contains a section heading');
  assert(/<style/.test(html) && /--rb-primary/.test(html), 'html carries design CSS vars');
  console.log('  ok - resumeHtml');

  // PDF: real selectable PDF buffer.
  const buf = await renderResumePdf(sampleDraft);
  assert(Buffer.isBuffer(buf) && buf.length > 1000, 'pdf buffer is non-trivial');
  assert(buf.slice(0, 5).toString() === '%PDF-', 'buffer is a PDF');
  console.log('  ok - renderResumePdf (' + buf.length + ' bytes)');

  await closeBrowser();
  console.log('\nverifyResumePdf: 2 checks passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
