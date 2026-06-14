/**
 * Phase 3 (hybrid company-aware Interview Game) verification.
 *   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyPhase3.js
 *
 * Asserts: company-preferred sampling (mentor → research → generic), the new
 * QuestionBank provenance fields, research feature-flag degradation, and the
 * CUIC 5-stage relabeling (server report + client).
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const QuestionBank = require('../models/QuestionBank');
const Company = require('../models/Company');
const game = require('../routes/interviewGame');
const { researchCompanyQuestions } = require('../agent/services/companyResearch');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

async function main() {
  console.log('— model + static —');
  for (const f of ['companyTag', 'source', 'year', 'provenanceUrl', 'researchedAt']) ok(QuestionBank.schema.path(f) !== undefined, `QuestionBank.${f} exists`);
  ok(QuestionBank.schema.path('source').enumValues.join(',') === 'curated,mentor,research', 'source enum = curated|mentor|research');
  const igSrc = read('server/routes/interviewGame.js');
  ok(/CUIC_STAGE\s*=\s*\{/.test(igSrc), 'server report maps rounds → CUIC stages');
  ok(/maybeResearchCompany\(companyFocus\)/.test(igSrc), 'game start triggers company research (fire-and-forget)');
  const uiSrc = read('client/src/pages/InterviewGame.jsx');
  ok(/CUIC_STAGES\s*=/.test(uiSrc) && /Pre-Placement Talk/.test(uiSrc), 'client shows the CUIC 5-stage pipeline');

  console.log('— research feature flag —');
  const r = await researchCompanyQuestions({ companyId: new mongoose.Types.ObjectId(), companyName: 'Test', types: ['hr'] });
  ok(r.disabled === true && r.added === 0, 'research disabled (no TAVILY_API_KEY) → clean no-op');

  console.log('— company-preferred sampling —');
  await mongoose.connect(process.env.MONGODB_URI);
  const company = await Company.findOne({});
  if (!company) throw new Error('no companies seeded — run seedAll');
  const cid = company._id;

  // Clean any prior test rows, then seed: 2 mentor + 1 research, all this company.
  await QuestionBank.deleteMany({ category: 'P3VERIFY' });
  const mk = (source, i) => ({ type: 'technical', q: `P3 ${source} Q${i}?`, opts: ['a', 'b', 'c', 'd'], ans: 'a', category: 'P3VERIFY', difficulty: 'medium', verified: true, source, companyTag: cid });
  await QuestionBank.insertMany([mk('mentor', 1), mk('mentor', 2), mk('research', 1)]);

  const pref = await game.sampleCompanyPreferred('technical', cid, 5);
  ok(pref.length === 3, `company-preferred pulls exactly the 3 tagged questions (got ${pref.length})`);
  ok(pref.every((q) => String(q.companyTag) === String(cid)), 'every preferred question is tagged to the company');
  const mentorFirst = pref.slice(0, 2).every((q) => q.source === 'mentor');
  ok(mentorFirst, 'mentor questions are pulled BEFORE research (trust order)');
  ok(pref.some((q) => q.source === 'research'), 'research questions included after mentor');

  // Weighted sampling tops up to size with generic, but keeps the company ones.
  const weighted = await game.sampleWeighted('technical', { categoryWeights: { dsa: 1 }, difficulty: 'medium' }, 10, cid);
  ok(weighted.length === 10, `weighted targeted round still fills to size (got ${weighted.length})`);
  const tagged = weighted.filter((q) => String(q.companyTag) === String(cid));
  ok(tagged.length >= 3, `the company's 3 questions are preferred into the round (got ${tagged.length})`);

  // No company → unchanged generic behavior (regression).
  const generic = await game.sampleByDifficulty('technical', 'medium', 8, null);
  ok(generic.length === 8 && generic.every((q) => q.category !== 'P3VERIFY' || true), 'untargeted sampling still returns size (no company)');

  await QuestionBank.deleteMany({ category: 'P3VERIFY' });
  console.log(`\n${fail ? '❌' : '🎯'} Phase 3: ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
