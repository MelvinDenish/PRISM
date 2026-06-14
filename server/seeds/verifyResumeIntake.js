/* Run: node server/seeds/verifyResumeIntake.js  (no DB / API key needed — llm.chat is stubbed) */
const assert = require('assert');
// config is Object.freeze'd and hasLLM() reads env at call-time — set a dummy key
// so intakeTurn passes the gate. The real LLM call is stubbed below, so the key value
// is never used. (Ensure no OpenRouter base URL, which would require LLM_API_KEY.)
delete process.env.LLM_BASE_URL;
process.env.GROQ_API_KEY = 'test-key-not-used';
const llm = require('../agent/llm');
const intake = require('../agent/services/resumeIntake');

let passed = 0; const ok = (l) => { passed += 1; console.log('  ok -', l); };

(async () => {
  // 1) When the model returns plain text, intakeTurn returns it as the next question.
  llm.chat = async () => ({ role: 'assistant', content: 'What role are you targeting?' });
  const r1 = await intake.intakeTurn({ userId: 'u1', messages: [{ role: 'user', content: 'make me a resume' }], persist: false });
  assert(r1.reply && /role/i.test(r1.reply) && !r1.draft, 'asks a question when not ready');
  ok('asks next question');

  // 2) When the model calls finalize_resume, intakeTurn shapes+validates and returns a draft (persist:false → no DB).
  llm.chat = async () => ({
    role: 'assistant', content: '',
    tool_calls: [{ id: 'c1', type: 'function', function: { name: 'finalize_resume', arguments: JSON.stringify({
      content: { personalInfo: { fullName: 'Asha Rao', summary: 'Backend engineer.' }, experience: [{ company: 'PayCo', position: 'SWE', description: 'Built things.' }], skills: ['Java'], education: [], projects: [] },
      design: { layout: 'sidebar-left', paletteVibe: 'plum', fontPairIndex: 1, density: 'roomy', headingStyle: 'bar' },
    }) } }],
  });
  const r2 = await intake.intakeTurn({ userId: 'u1', messages: [{ role: 'user', content: 'ok generate' }], persist: false });
  assert(r2.draft, 'returns a draft when finalized');
  assert(r2.draft.personalInfo.fullName === 'Asha Rao', 'content shaped through');
  assert(r2.draft.design.layout === 'sidebar-left', 'design carried + validated');
  assert(/^#[0-9a-fA-F]{6}$/.test(r2.draft.design.palette.primary), 'palette built from vibe');
  ok('finalizes into a validated draft');

  console.log(`\nverifyResumeIntake: ${passed} checks passed`);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
