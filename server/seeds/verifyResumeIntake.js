/* Run: node server/seeds/verifyResumeIntake.js  (no DB / API key needed — llm.chat is stubbed)
 *
 * Covers the gap-aware, deterministically-gated intake:
 *   • resumeCompleteness: seed-from-profile, mergeCollected (amnesia-proof), assessCompleteness gate
 *   • resumeIntake.intakeTurn: record_fields delta merge, gate-driven `ready`, graceful fallback
 */
const assert = require('assert');
// hasResumeLlm() reads env at call-time — set a dummy key so intakeTurn proceeds.
// The real LLM call is stubbed below, so the value is never used. (No OpenRouter base
// URL, which would require LLM_API_KEY.)
delete process.env.LLM_BASE_URL;
process.env.GROQ_API_KEY = 'test-key-not-used';
const llm = require('../agent/llm');
const intake = require('../agent/services/resumeIntake');
const comp = require('../agent/services/resumeCompleteness');

let passed = 0; const ok = (l) => { passed += 1; console.log('  ok -', l); };

const PROFILE = {
  name: 'Aditya Kumar', email: 'aditya@prism.dev', linkedin: 'https://linkedin.com/in/aditya',
  college: 'NIT Trichy', department: 'CSE', graduationYear: 2028,
  cgpa: '5', tenthPercent: '91', twelfthPercent: '99', skills: ['Java', 'Python', 'React'],
};

(async () => {
  // ── 1. Seed from profile: known facts satisfied, gaps remain ──────────────
  const seeded = comp.seedCollectedFromProfile(PROFILE);
  const a0 = comp.assessCompleteness(seeded);
  const has = (a, k) => a.have.some((h) => h.key === k);
  const needs = (a, k) => a.missing.some((m) => m.key === k);
  assert(!a0.gateMet, 'thin profile does not pass the gate');
  assert(has(a0, 'identity') && has(a0, 'links') && has(a0, 'academics') && has(a0, 'skills'),
    'profile satisfies identity/links/academics/skills');
  assert(needs(a0, 'projects') && needs(a0, 'education') && needs(a0, 'enoughContent'),
    'projects/education(degree)/content still missing');
  ok('seed-from-profile assessment');

  // ── 2. Amnesia-proof merge across many turns ──────────────────────────────
  let c = seeded;
  c = comp.mergeCollected(c, { education: [{ institution: 'NIT Trichy', degree: 'B.Tech' }] }); // turn 2
  c = comp.mergeCollected(c, { projects: [{ name: 'Chess AI' }] });                              // turn 3
  c = comp.mergeCollected(c, { projects: [{ name: 'Chess AI', description: 'short', technologies: 'Python' }] }); // turn 4 (update, not dup)
  c = comp.mergeCollected(c, { skills: ['Java', 'Docker'] });                                    // turn 5 (union, no dup Java)
  c = comp.mergeCollected(c, { projects: [{ name: 'PRISM Resume', description: 'short two' }] }); // turn 6
  assert(c.education[0].degree === 'B.Tech', 'degree set on turn 2 survives to turn 6 (no amnesia)');
  assert(c.education.length === 1, 'degree merged into existing institution, not duplicated');
  assert(c.projects.length === 2, 'Chess AI updated in place, not duplicated');
  assert(c.projects[0].description === 'short' && c.projects[0].technologies === 'Python', 'project fields accumulate');
  assert(c.skills.filter((s) => s.toLowerCase() === 'java').length === 1, 'skills union dedupes case-insensitively');
  ok('mergeCollected accumulates without amnesia or duplication');

  // ── 3. Gate flips only once content is deep enough to fill a page ──────────
  const aThin = comp.assessCompleteness(c);
  assert(has(aThin, 'projects') && has(aThin, 'education'), '2 projects + degree satisfied');
  assert(needs(aThin, 'enoughContent') && !aThin.gateMet, 'thin descriptions keep the gate closed');
  const longDesc = 'word '.repeat(120).trim(); // 120 words
  c = comp.mergeCollected(c, { projects: [{ name: 'Chess AI', description: longDesc }] });
  c = comp.mergeCollected(c, { projects: [{ name: 'PRISM Resume', description: longDesc }] });
  const aFull = comp.assessCompleteness(c);
  assert(aFull.contentScore >= comp.MIN_CONTENT_WORDS, 'content score crosses the threshold');
  assert(aFull.gateMet && aFull.missing.length === 0, 'gate opens once everything + enough content present');
  ok('enoughContent gate + full-pass');

  // ── 4. intakeTurn merges the record_fields delta and gates on the result ──
  llm.chat = async () => ({
    role: 'assistant', content: '',
    tool_calls: [{ id: 'c1', type: 'function', function: { name: 'record_fields', arguments: JSON.stringify({
      delta: { projects: [{ name: 'Chess AI', description: 'A minimax engine.' }] },
      next_question: 'Nice — tell me about a second project.',
    }) } }],
  });
  const r1 = await intake.intakeTurn({ messages: [{ role: 'user', content: 'I built a chess AI' }], collected: seeded, profile: PROFILE });
  assert(r1.reply === 'Nice — tell me about a second project.', 'next_question returned as reply');
  assert(r1.collected.projects.length === 1 && r1.collected.education.length === 1, 'delta merged into collected');
  assert(typeof r1.assessment.gateMet === 'boolean' && r1.ready === r1.assessment.gateMet, 'ready mirrors deterministic gate');
  ok('intakeTurn merges delta + gates');

  // ── 5. Opening turn (no user message): deterministic opener, NO LLM call ───
  let llmCalled = false;
  llm.chat = async () => { llmCalled = true; return { role: 'assistant', content: 'should not be used' }; };
  const r2 = await intake.intakeTurn({ messages: [], collected: null, profile: PROFILE });
  assert(!llmCalled, 'opening turn does not call the LLM');
  assert(r2.collected.personalInfo.fullName === 'Aditya Kumar', 'first turn seeds collected from profile');
  assert(typeof r2.reply === 'string' && r2.reply.length > 0, 'returns a deterministic opener');
  assert(!r2.ready, 'seeded-only state is not ready');
  ok('opening turn is deterministic + seeds from profile');

  // ── 6. Graceful fallback when the model emits no tool call ─────────────────
  llm.chat = async () => ({ role: 'assistant', content: 'What is your second project?' });
  const r3 = await intake.intakeTurn({ messages: [{ role: 'user', content: 'hi' }], collected: seeded, profile: PROFILE });
  assert(/second project/i.test(r3.reply) && r3.collected === seeded, 'falls back to plain text, state unchanged');
  ok('graceful no-tool-call fallback');

  console.log(`\nverifyResumeIntake: ${passed} checks passed`);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
