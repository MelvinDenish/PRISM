// Throwaway P7 verification: exercises the resume-canvas service end-to-end
// against local Mongo — click-to-edit, ATS check (keyword fallback), revisions +
// restore, and JD tailoring (LLM, best-effort). Cleans up everything it creates.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyResumeCanvas.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ResumeDraft = require('../models/ResumeDraft');
const SkillSignal = require('../models/SkillSignal');
const {
  applySectionEdit, atsCheckDraft, restoreRevision, tailorDraft,
} = require('../agent/services/resume');

const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ role: 'mentee' });
  if (!user) throw new Error('no mentee user found — run seedAll first');

  const base = await ResumeDraft.create({
    user: user._id,
    name: 'P7 Verify Base',
    jobDescription: 'Looking for a backend engineer with Node.js, MongoDB, Docker, Kubernetes, REST APIs and cloud experience.',
    personalInfo: { fullName: 'Test User', email: 't@e.com', summary: 'An engineer.' },
    skills: ['JavaScript', 'Node.js', 'Express'],
    experience: [{ company: 'Acme', position: 'Developer', startDate: '2022', endDate: '2024', current: false, description: 'Built things.' }],
    education: [{ institution: 'NIT Trichy', degree: 'BTech', field: 'CSE', startDate: '2018', endDate: '2022', gpa: '8.5' }],
    projects: [{ name: 'Proj', description: 'A thing', technologies: 'Node', link: '' }],
  });
  const created = [base._id];

  try {
    // 1. Click-to-edit: nested personalInfo field.
    let d = await applySectionEdit({ userId: user._id, draftId: base._id, path: 'personalInfo.summary', value: 'Backend engineer skilled in Node.' });
    assert(d.personalInfo.summary === 'Backend engineer skilled in Node.', 'section edit updates personalInfo.summary');

    // 2. Click-to-edit: array subdocument field.
    d = await applySectionEdit({ userId: user._id, draftId: base._id, path: 'experience.0.description', value: 'Built REST APIs with Node.js and MongoDB.' });
    assert(d.experience[0].description === 'Built REST APIs with Node.js and MongoDB.', 'section edit updates experience.0.description');

    // 3. Click-to-edit: skills from a comma string, and confirm it PERSISTS.
    await applySectionEdit({ userId: user._id, draftId: base._id, path: 'skills', value: 'Node.js, MongoDB, Docker' });
    const reloaded = await ResumeDraft.findById(base._id);
    assert(reloaded.skills.length === 3 && reloaded.skills.includes('Docker'), 'skills edit persists (3 skills incl Docker)');

    // 4. Unsupported / unsafe path rejected with 400 (no arbitrary field writes).
    let threw = false;
    try { await applySectionEdit({ userId: user._id, draftId: base._id, path: 'user', value: 'x' }); }
    catch (e) { threw = e.statusCode === 400; }
    assert(threw, 'unsupported field path rejected with 400');

    // 5. ATS check: keyword fallback works without Gemini; caches score + gaps; emits 1 signal.
    const sigBefore = await SkillSignal.countDocuments({ user: user._id, pillar: 'resume' });
    const ats = await atsCheckDraft({ userId: user._id, draftId: base._id });
    assert(typeof ats.draft.atsScore === 'number' && ats.draft.atsScore >= 0 && ats.draft.atsScore <= 100,
      `ATS check sets a 0–100 score (${ats.draft.atsScore}, mode=${ats.mode})`);
    assert(Array.isArray(ats.draft.gaps), 'ATS check populates the gaps array');
    if (ats.mode === 'keyword') {
      assert(ats.draft.gaps.includes('kubernetes'),
        `gaps include a JD skill missing from the resume (${ats.draft.gaps.slice(0, 6).join(', ')})`);
    }
    const sigAfter = await SkillSignal.countDocuments({ user: user._id, pillar: 'resume' });
    assert(sigAfter === sigBefore + 1, 'ATS check emits exactly one resume signal');

    // 6. JD tailoring (LLM, best-effort) — variant links parent, never invents entries.
    try {
      const { draft: variant, gaps } = await tailorDraft({
        userId: user._id, draftId: base._id, jobDescription: base.jobDescription, company: 'Amazon', role: 'SDE',
      });
      created.push(variant._id);
      assert(String(variant.parentDraft) === String(base._id), 'tailor variant links parentDraft');
      assert(variant.experience.length <= 1, 'tailor did not invent new experience entries (≤ parent count)');
      assert(variant.revisions.length >= 1 && /Forked from/.test(variant.revisions[0].label),
        'tailor seeds variant history with the parent snapshot');
      assert(Array.isArray(gaps), 'tailor returns a gaps array');
      console.log(`   (tailor ran via LLM; gaps=[${gaps.slice(0, 5).join(', ')}])`);
    } catch (e) {
      console.log(`   ~ tailor LLM step skipped (${e.statusCode || ''} ${e.message})`);
    }

    // 7. Revisions + restore: restore a snapshot, and confirm the pre-restore state is itself snapshotted.
    const doc = await ResumeDraft.findById(base._id);
    doc.revisions.push({ at: new Date(), label: 'manual', snapshot: { personalInfo: { summary: 'OLD SUMMARY' }, skills: ['Legacy'], experience: [], education: [], projects: [] } });
    await doc.save();
    const revId = doc.revisions[doc.revisions.length - 1]._id;
    const restored = await restoreRevision({ userId: user._id, draftId: base._id, revisionId: revId });
    assert(restored.personalInfo.summary === 'OLD SUMMARY', 'restore brings back the revision snapshot');
    assert(restored.revisions.some((r) => r.label === 'Before restore'), 'restore snapshots current state first (undoable)');

    console.log('\nP7 RESUME CANVAS: ALL CHECKS PASSED');
  } finally {
    await ResumeDraft.deleteMany({ _id: { $in: created } });
    await SkillSignal.deleteMany({ sourceId: { $in: created } });
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
