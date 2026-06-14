// P0.2 + P1 write-path HTTP smoke (the acceptance criteria that needed a real
// round-trip). Boot a server first:
//   PORT=5058 node server.js
//   SMOKE_BASE=http://localhost:5058 node seeds/verifyP0P1Http.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const SkillSignal = require('../models/SkillSignal');

const BASE = process.env.SMOKE_BASE || 'http://localhost:5000';
const EMAIL = process.env.SMOKE_EMAIL || 'aditya@prism.dev';
const PASS = process.env.SMOKE_PASS || 'password123';
let okN = 0;
const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); okN++; console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const before = await User.findOne({ email: EMAIL });
  const origRole = before.role;

  const lj = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASS }) })).json();
  if (!lj.token) throw new Error('login failed');
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${lj.token}` };

  // ── P1: PUT /me persists academics; role/password are NOT settable here ──
  const reg = `P1SMOKE-${Date.now()}`;
  const put = await (await fetch(`${BASE}/api/users/me`, { method: 'PUT', headers: auth, body: JSON.stringify({ cgpa: 8.42, registerNumber: reg, department: 'CSE', tenthPercent: 91, role: 'admin', password: 'hax' }) })).json();
  assert(put.success && put.user.cgpa === 8.42 && put.user.registerNumber === reg, 'PUT /me returns persisted academics');
  assert(put.user.role === origRole, 'PUT /me ignored role (no privilege escalation)');
  assert(put.user.password === undefined, 'PUT /me never returns password');

  const me = await (await fetch(`${BASE}/api/auth/me`, { headers: auth })).json();
  assert(me.user.cgpa === 8.42 && me.user.registerNumber === reg && me.user.department === 'CSE', 'academics persisted (re-fetched via /auth/me)');
  const dbUser = await User.findOne({ email: EMAIL });
  assert(dbUser.role === origRole, 'DB role unchanged after attempted role escalation');

  // ── P0.2: Behavioral Practice questions + AI evaluate → score + signal ──
  const q = await (await fetch(`${BASE}/api/behavioral-practice/questions`, { headers: auth })).json();
  assert(q.success && Array.isArray(q.questions) && q.questions.length >= 3, `behavioral-practice serves prompts (${q.questions.length})`);

  const sigBefore = await SkillSignal.countDocuments({ user: dbUser._id, source: 'behavioral_practice' });
  const ev = await (await fetch(`${BASE}/api/behavioral-practice/evaluate`, { method: 'POST', headers: auth, body: JSON.stringify({
    question: 'Tell me about a time you resolved a conflict in a team.',
    answer: 'During my final-year project our team disagreed on the database choice. As the lead, I set up a short spike: each side built a small prototype, we measured query latency on our real dataset, and Postgres won on a 40% faster p95. I documented the decision and we shipped on time with no further friction.',
  }) })).json();
  assert(ev.success && typeof ev.evaluation.score === 'number' && ev.evaluation.score >= 0 && ev.evaluation.score <= 100, `evaluate returns a 0-100 score (got ${ev.evaluation.score})`);
  assert(Array.isArray(ev.evaluation.strengths) && Array.isArray(ev.evaluation.improvements), 'evaluate returns strengths + improvements arrays');
  const sigAfter = await SkillSignal.countDocuments({ user: dbUser._id, source: 'behavioral_practice' });
  assert(sigAfter === sigBefore + 1, 'evaluate emitted a communication signal (behavioral_practice source)');

  // Short answers are rejected (server-authoritative guard).
  const tooShort = await fetch(`${BASE}/api/behavioral-practice/evaluate`, { method: 'POST', headers: auth, body: JSON.stringify({ question: 'x', answer: 'no' }) });
  assert(tooShort.status === 400, 'evaluate rejects too-short answers (400)');

  console.log(`\nP0.2 + P1 HTTP SMOKE: ALL ${okN} CHECKS PASSED`);
  await mongoose.disconnect();
})().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
