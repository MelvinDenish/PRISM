// In-process verification for Copilot P3 (resume canvas — server side).
// Proves the refineDraft contract (server-side changedSections diff, the
// no-invention guardrail, ownership 404, input/shape validation) deterministically
// by stubbing the LLM, then runs a live-LLM happy path and a real byte-level
// export check through the P2 generateDocument pipeline.
//
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyP3ResumeCanvas.js
//
// Style mirrors seeds/verifyPrepProfileAPI.js. Creates its own throwaway drafts
// and a throwaway second user; cleans them up at the end.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const ResumeDraft = require('../models/ResumeDraft');
const Artifact = require('../models/Artifact');
const storage = require('../utils/storage');
const llm = require('../agent/llm');
const { refineDraft } = require('../agent/services/resume');
const { generateDocument } = require('../agent/services/document');

let passed = 0;
const ok = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); passed++; console.log(`  ok — ${msg}`); };

// Capture an expected throw and return the error for inspection.
async function throwsWith(fn, statusCode, label) {
  try { await fn(); }
  catch (e) {
    ok(e.statusCode === statusCode, `${label} → throws statusCode ${statusCode} (got ${e.statusCode}: ${e.message})`);
    return e;
  }
  throw new Error(`FAIL: ${label} → expected throw with statusCode ${statusCode}, but it resolved`);
}

// Build the full 5-section object an LLM is supposed to return, from a draft.
const fullObjOf = (d) => ({
  personalInfo: {
    fullName: d.personalInfo.fullName, email: d.personalInfo.email, phone: d.personalInfo.phone,
    location: d.personalInfo.location, linkedin: d.personalInfo.linkedin, github: d.personalInfo.github,
    portfolio: d.personalInfo.portfolio, summary: d.personalInfo.summary,
  },
  education: d.education.map((e) => ({ institution: e.institution, degree: e.degree, field: e.field, startDate: e.startDate, endDate: e.endDate, gpa: e.gpa })),
  experience: d.experience.map((e) => ({ company: e.company, position: e.position, startDate: e.startDate, endDate: e.endDate, current: e.current, description: e.description })),
  skills: [...d.skills],
  projects: d.projects.map((p) => ({ name: p.name, description: p.description, technologies: p.technologies, link: p.link })),
});

// Make llm.chat return a fixed payload (object → JSON string, string → as-is).
const stub = (payload) => {
  llm.chat = async () => ({ content: typeof payload === 'string' ? payload : JSON.stringify(payload) });
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const realChat = llm.chat;

  const owner = await User.findOne({ role: 'mentee' });
  if (!owner) throw new Error('no mentee user found — run seedAll first');

  // Throwaway second user for the cross-user ownership check.
  const intruder = await User.create({
    name: 'P3 Verify Intruder', email: `p3-verify-${Date.now()}@example.com`,
    password: 'password123', role: 'mentee',
  });

  const makeDraft = () => ResumeDraft.create({
    user: owner._id,
    name: 'P3 Verify Draft',
    personalInfo: { fullName: 'Test Candidate', email: 't@example.com', phone: '555', location: 'NYC', linkedin: '', github: '', portfolio: '', summary: 'Original summary.' },
    education: [{ institution: 'NIT', degree: 'BTech', field: 'CS', startDate: '2018', endDate: '2022', gpa: '8.5' }],
    experience: [
      { company: 'Acme', position: 'SWE', startDate: '2022', endDate: '', current: true, description: 'Built things.' },
      { company: 'Globex', position: 'Intern', startDate: '2021', endDate: '2021', current: false, description: 'Interned.' },
    ],
    skills: ['Java', 'Python', 'React'],
    projects: [{ name: 'P1', description: 'A project', technologies: 'Node', link: '' }],
    lastGenerated: new Date(),
  });

  const createdDraftIds = [];
  const createdArtifactIds = [];
  try {
    console.log('\n[1] Input + config validation (deterministic)');
    const d0 = await makeDraft(); createdDraftIds.push(d0._id);
    await throwsWith(() => refineDraft({ userId: owner._id, draftId: d0._id, instruction: '' }), 400, 'empty instruction');
    await throwsWith(() => refineDraft({ userId: owner._id, draftId: d0._id, instruction: 'x'.repeat(501) }), 400, '>500-char instruction');

    console.log('\n[2] Ownership (deterministic — no LLM reached)');
    await throwsWith(() => refineDraft({ userId: intruder._id, draftId: d0._id, instruction: 'make it punchier' }), 404, "intruder refining owner's draft");

    console.log('\n[3] Server-side changedSections diff (stubbed LLM)');
    // 3a: only the summary changes → changedSections must be exactly ['personalInfo'].
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const after = fullObjOf(d); after.personalInfo.summary = 'A sharper, punchier one-line summary.';
      stub(after);
      const { changedSections } = await refineDraft({ userId: owner._id, draftId: d._id, instruction: 'punchier summary' });
      ok(Array.isArray(changedSections), 'changedSections is an array');
      ok(changedSections.length === 1 && changedSections[0] === 'personalInfo',
        `summary-only edit ⇒ changedSections === ['personalInfo'] (got ${JSON.stringify(changedSections)})`);
      const reloaded = await ResumeDraft.findById(d._id);
      ok(reloaded.personalInfo.summary === 'A sharper, punchier one-line summary.', 'persisted: new summary written to DB');
    }
    // 3b: reorder skills only → changedSections includes 'skills', excludes 'experience'.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const after = fullObjOf(d); after.skills = ['React', 'Python', 'Java'];
      stub(after);
      const { changedSections } = await refineDraft({ userId: owner._id, draftId: d._id, instruction: 'reorder skills' });
      ok(changedSections.includes('skills'), "skills reorder ⇒ 'skills' in changedSections");
      ok(!changedSections.includes('experience'), "untouched experience ⇒ NOT in changedSections");
    }
    // 3c: identical payload → no-op, changedSections empty (refine never falsely reports change).
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      stub(fullObjOf(d));
      const { changedSections } = await refineDraft({ userId: owner._id, draftId: d._id, instruction: 'no real change' });
      ok(changedSections.length === 0, `identical refine ⇒ changedSections empty (got ${JSON.stringify(changedSections)})`);
    }

    console.log('\n[4] No-invention guardrail (stubbed LLM)');
    // 4a: extra experience entry → 422.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const after = fullObjOf(d);
      after.experience.push({ company: 'Google', position: 'Staff SWE', startDate: '2019', endDate: '2021', current: false, description: 'Invented role.' });
      stub(after);
      await throwsWith(() => refineDraft({ userId: owner._id, draftId: d._id, instruction: 'add a Google job' }), 422, 'added experience entry (hallucination)');
      const reloaded = await ResumeDraft.findById(d._id);
      ok(reloaded.experience.length === 2, 'guardrail rejection left the draft UNCHANGED (still 2 jobs)');
    }
    // 4b: extra education entry → 422.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const after = fullObjOf(d);
      after.education.push({ institution: 'MIT', degree: 'PhD', field: 'AI', startDate: '2022', endDate: '2026', gpa: '4.0' });
      stub(after);
      await throwsWith(() => refineDraft({ userId: owner._id, draftId: d._id, instruction: 'add a PhD' }), 422, 'added education entry (hallucination)');
    }

    console.log('\n[5] Malformed / wrong-shape output (stubbed LLM) — draft left unchanged');
    // 5a: unparseable text.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      stub('I am sorry, I cannot help with that.');
      await throwsWith(() => refineDraft({ userId: owner._id, draftId: d._id, instruction: 'whatever' }), 422, 'non-JSON output');
    }
    // 5b: JSON missing a required section key.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const after = fullObjOf(d); delete after.skills;
      stub(after);
      await throwsWith(() => refineDraft({ userId: owner._id, draftId: d._id, instruction: 'drop skills key' }), 422, 'JSON missing "skills" section');
    }
    // 5c: JSON array instead of object.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      stub('[1,2,3]');
      await throwsWith(() => refineDraft({ userId: owner._id, draftId: d._id, instruction: 'array' }), 422, 'JSON array (wrong top-level shape)');
    }

    // Restore the real client for the live paths.
    llm.chat = realChat;

    console.log('\n[6] Export → real bytes through generateDocument (P2 pipeline)');
    // Mirrors what routes/resumeBuilder _buildResumeSections feeds generateDocument.
    {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const content = { sections: [
        { paragraphs: [d.personalInfo.fullName, [d.personalInfo.email, d.personalInfo.phone, d.personalInfo.location].join(' • ')] },
        { heading: 'Summary', paragraphs: [d.personalInfo.summary] },
        { heading: 'Skills', paragraphs: [d.skills.join(' • ')] },
        { heading: 'Experience', paragraphs: d.experience.flatMap((e) => [`${e.position} — ${e.company}`, e.description]) },
      ] };
      for (const fmt of ['pdf', 'docx']) {
        const art = await generateDocument({ userId: owner._id, kind: 'resume', title: 'P3 Verify Resume', format: fmt, content });
        createdArtifactIds.push(art.id);
        ok(art.id && art.url === `/api/artifacts/${art.id}/download`, `${fmt}: artifact persisted with owner-gated url`);
        const row = await Artifact.findById(art.id);
        // Read bytes the same way the download route does: server/uploads/<key>.
        const buf = await fs.promises.readFile(path.join(__dirname, '..', 'uploads', row.artifactKey));
        const magic = fmt === 'pdf' ? buf.slice(0, 4).toString('latin1') : buf.slice(0, 2).toString('latin1');
        const want = fmt === 'pdf' ? '%PDF' : 'PK';
        ok(magic === want, `${fmt}: file bytes start with "${want}" (got "${magic}") — real document`);
      }
    }

    console.log('\n[7] Live-LLM happy path (best-effort; SKIP on rate-limit/network)');
    try {
      const d = await makeDraft(); createdDraftIds.push(d._id);
      const before = JSON.stringify(fullObjOf(d));
      const { draft, changedSections } = await refineDraft({
        userId: owner._id, draftId: d._id,
        instruction: 'Rewrite the professional summary to be one punchy sentence.',
      });
      ok(Array.isArray(changedSections), 'live: changedSections is an array');
      ok(draft.experience.length === 2 && draft.education.length === 1 && draft.projects.length === 1,
        'live: real model did NOT add/remove entries (guardrail-safe output)');
      const changed = JSON.stringify(fullObjOf(draft)) !== before;
      console.log(`  · live model ${changed ? 'changed' : 'left unchanged'} the draft; changedSections=${JSON.stringify(changedSections)}`);
    } catch (e) {
      if (e.statusCode === 502 || e.statusCode === 503 || /fetch|network|429|rate/i.test(e.message)) {
        console.log(`  ~ SKIP live happy path (LLM unavailable: ${e.message})`);
      } else { throw e; }
    }

    console.log(`\nP3 RESUME CANVAS: ${passed} checks passed.`);
  } finally {
    // Cleanup throwaway data.
    if (createdDraftIds.length) await ResumeDraft.deleteMany({ _id: { $in: createdDraftIds } });
    for (const id of createdArtifactIds) {
      const row = await Artifact.findById(id);
      if (row) { try { await storage.deleteFile(row.artifactKey); } catch { /* best-effort */ } await Artifact.deleteOne({ _id: id }); }
    }
    await User.deleteOne({ _id: intruder._id });
    await mongoose.disconnect();
  }
})().catch((e) => { console.error('\n' + e.message); process.exit(1); });
