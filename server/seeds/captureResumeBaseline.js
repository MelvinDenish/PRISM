/**
 * Throwaway harness to RENDER + SCORE the AI-authored resume so we have a concrete
 * "before/after" to compare the quality upgrade against. Writes HTML to server/tmp/
 * and logs the design generationMeta (incl. vision score) + a vision critique.
 *
 *   node seeds/captureResumeBaseline.js [label] [runs]
 *     label : filename prefix (default "baseline")
 *     runs  : how many resumes to author (default 1)
 *
 * Not wired into the app; safe to delete after the upgrade is verified.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { shapeAuthorContent, authorHtml } = require('../agent/services/resumeAuthor');
const { renderHtmlDoc } = require('../agent/services/resumePdf');
const { critiqueDesign } = require('../agent/core/designCritic');
const { closeBrowser } = require('../agent/services/resumePdf');

const label = process.argv[2] || 'baseline';
const runs = Math.max(1, parseInt(process.argv[3], 10) || 1);

// A realistic, complete final-year CS student (fictional) so the loop has enough to fill a page.
const RAW = {
  personalInfo: {
    fullName: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+91 98765 43210',
    location: 'Chennai, India', linkedin: 'linkedin.com/in/aaravsharma', github: 'github.com/aaravsharma',
    portfolio: 'aarav.dev', summary: '',
  },
  education: [{ institution: 'College of Engineering, Guindy (Anna University)', degree: 'B.E.', field: 'Computer Science and Engineering', startDate: '2022', endDate: '2026', gpa: '8.7' }],
  experience: [{ company: 'Zoho Corporation', position: 'Software Engineering Intern', startDate: 'May 2025', endDate: 'Jul 2025', current: false, description: 'Worked on the analytics dashboard team building internal reporting tools.' }],
  projects: [
    { name: 'CampusEats', description: 'A food-ordering app for the campus canteen.', technologies: 'React, Node.js, MongoDB, Socket.IO', link: 'github.com/aaravsharma/campuseats' },
    { name: 'LeafLens', description: 'A plant-disease classifier from leaf photos.', technologies: 'Python, PyTorch, FastAPI', link: 'github.com/aaravsharma/leaflens' },
  ],
  skills: ['Java', 'Python', 'JavaScript', 'C++', 'React', 'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'Git', 'Linux'],
  certifications: [{ name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', date: '2025' }],
  achievements: ['Finalist, Smart India Hackathon 2025', 'Top 5% on LeetCode (1900+ rating)'],
  positionsOfResponsibility: ['Technical Lead, College Coding Club', 'Volunteer, IEEE Student Branch'],
  languages: ['English', 'Hindi', 'Tamil'],
  hobbies: ['Competitive programming', 'Chess'],
  cgpa: '8.7', tenthPercent: '94', twelfthPercent: '91', registerNumber: '2022103045',
};

(async () => {
  const tmp = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const shaped = shapeAuthorContent(RAW, {});

  for (let i = 1; i <= runs; i++) {
    const t0 = Date.now();
    const { html, pages, meta } = await authorHtml({ content: shaped });
    const file = path.join(tmp, `${label}-${i}.html`);
    fs.writeFileSync(file, html);

    // Independent vision score of the FINAL render (so before/after use the same yardstick).
    let visionScore = null, looksGeneric = null;
    try {
      const r = await renderHtmlDoc(html, { measure: false, screenshot: true });
      if (r.screenshot) { const c = await critiqueDesign(r.screenshot); visionScore = c.score; looksGeneric = c.looksGeneric; }
    } catch (e) { console.warn('  (vision score unavailable:', e.message, ')'); }

    console.log(`\n=== ${label} #${i} ===`);
    console.log('  file        :', file);
    console.log('  pages       :', pages);
    console.log('  elapsed(ms) :', Date.now() - t0);
    console.log('  meta        :', JSON.stringify(meta));
    console.log('  visionScore :', visionScore, '| looksGeneric:', looksGeneric);
  }

  await closeBrowser();
  process.exit(0);
})().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });
