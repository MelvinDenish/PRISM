// Phase 2 HTTP smoke — exercises the REAL learning-path final-test routes.
// Start a server against local mongo first, then run this:
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" PORT=5056 node server.js
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" SMOKE_BASE=http://localhost:5056 node seeds/verifyPhase2Http.js
//
// Proves: servedKey NEVER leaves the server (generate + GET test + submit), the
// 90% gate (fail < 90 → no cert; 100 → pass + cert), coding test cases stay
// hidden, and the public /certificate/:certId returns ONLY safe fields.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Topic = require('../models/Topic');
const LearningPath = require('../models/LearningPath');

const BASE = process.env.SMOKE_BASE || 'http://localhost:5000';
const EMAIL = process.env.SMOKE_EMAIL || 'aditya@prism.dev';
const PASS = process.env.SMOKE_PASS || 'password123';
let okN = 0;
const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); okN++; console.log(`ok — ${m}`); };
const deepHasKey = (o, key) => {
  if (!o || typeof o !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(o, key)) return true;
  return Object.values(o).some((v) => deepHasKey(v, key));
};

const mkPath = (userId, topicId, title) => LearningPath.create({
  user: userId, topic: topicId, title, level: 'beginner',
  steps: [{ order: 1, title: 'Step 1', completed: true, completedAt: new Date() }],
  totalSteps: 1, completedSteps: 1, progress: 100,
});

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: EMAIL });
  if (!user) throw new Error(`seed user ${EMAIL} not found — run seedAll`);
  const mcqTopic = await Topic.findOne({ name: 'Database Management' }) || await Topic.findOne({});
  const codeTopic = await Topic.findOne({ name: 'Arrays' });

  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })).json();
  if (!lr.token) throw new Error('login failed: ' + JSON.stringify(lr));
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${lr.token}` };

  const created = [];

  // ─────────────── MCQ path ───────────────
  const mp = await mkPath(user._id, mcqTopic._id, 'PHASE2 MCQ Test Path'); created.push(mp._id);
  const gen = await (await fetch(`${BASE}/api/learning-paths/${mp._id}/test/generate`, { method: 'POST', headers: auth })).json();
  assert(gen.success && gen.path?.finalTest?.generated, 'MCQ test generated');
  assert(gen.path.finalTest.format === 'mcq', 'format is mcq for a non-coding topic');
  assert(!deepHasKey(gen.path.finalTest, 'servedKey'), 'generate response carries NO servedKey (answer key hidden)');
  assert(gen.path.finalTest.questions.every((q) => !('ans' in q)), 'MCQ questions carry no per-question answer');

  const getTest = await (await fetch(`${BASE}/api/learning-paths/${mp._id}/test`, { headers: auth })).json();
  assert(!deepHasKey(getTest.path.finalTest, 'servedKey'), 'GET /:id/test carries NO servedKey');

  // Read the real answer key from the DB (server-only).
  const dbPath = await LearningPath.findById(mp._id).lean();
  const key = dbPath.finalTest.servedKey; // [{id, ans}]
  assert(Array.isArray(key) && key.length >= 4, `servedKey persisted server-side (${key.length} answers)`);
  const qIds = gen.path.finalTest.questions.map((q) => q.id);
  const ansById = new Map(key.map((k) => [k.id, k.ans]));
  const opts = new Map(gen.path.finalTest.questions.map((q) => [q.id, q.opts]));

  // FAIL: answer every question wrong → score 0 → no pass, no cert.
  const wrong = qIds.map((id) => ({ id, selectedAnswer: opts.get(id).find((o) => o !== ansById.get(id)) }));
  const fail = await (await fetch(`${BASE}/api/learning-paths/${mp._id}/test/submit`, { method: 'POST', headers: auth, body: JSON.stringify({ answers: wrong }) })).json();
  assert(fail.success && fail.passed === false, `all-wrong submit fails the gate (score ${fail.score})`);
  assert(!fail.certificate, 'no certificate issued on a failing attempt');

  // PASS: answer every question correctly → 100 → pass + certificate.
  const right = qIds.map((id) => ({ id, selectedAnswer: ansById.get(id) }));
  const pass = await (await fetch(`${BASE}/api/learning-paths/${mp._id}/test/submit`, { method: 'POST', headers: auth, body: JSON.stringify({ answers: right }) })).json();
  assert(pass.success && pass.score === 100 && pass.passed === true, `all-correct submit passes (score ${pass.score})`);
  assert(pass.certificate?.certId, 'certificate issued with a certId on pass');
  assert(!deepHasKey(pass.path.finalTest, 'servedKey'), 'submit response still carries NO servedKey');
  const certId = pass.certificate.certId;

  // Idempotent cert: a second pass does not mint a new certId.
  const pass2 = await (await fetch(`${BASE}/api/learning-paths/${mp._id}/test/submit`, { method: 'POST', headers: auth, body: JSON.stringify({ answers: right }) })).json();
  assert(pass2.certificate?.certId === certId && pass2.justIssued === false, 'certificate is stable across re-submits (no new certId)');

  // PUBLIC certificate verification — no auth header; only safe fields.
  const cert = await (await fetch(`${BASE}/api/learning-paths/certificate/${certId}`)).json();
  assert(cert.success && cert.certificate, 'public /certificate/:certId resolves without auth');
  const cf = cert.certificate;
  assert(cf.name && cf.topic && typeof cf.bestScore === 'number' && cf.issuedAt, 'certificate returns name/topic/bestScore/issuedAt');
  assert(!('servedKey' in cf) && !('user' in cf) && !('attempts' in cf) && !('finalTest' in cf), 'public certificate leaks nothing sensitive');

  // ─────────────── Coding path ───────────────
  if (codeTopic) {
    const cp = await mkPath(user._id, codeTopic._id, 'PHASE2 Coding Test Path'); created.push(cp._id);
    const cgen = await (await fetch(`${BASE}/api/learning-paths/${cp._id}/test/generate`, { method: 'POST', headers: auth })).json();
    assert(cgen.success && cgen.path.finalTest.format === 'coding', 'coding topic → coding-format test');
    assert(cgen.path.finalTest.questions.every((q) => !('testCases' in q)), 'coding questions carry NO hidden test cases');
    assert(!deepHasKey(cgen.path.finalTest, 'servedKey'), 'coding generate carries NO servedKey');
    const cdb = await LearningPath.findById(cp._id).lean();
    assert((cdb.finalTest.servedKey || []).every((p) => Array.isArray(p.testCases) && p.testCases.length >= 3), 'coding answer key has verified test cases server-side');
    const cfail = await (await fetch(`${BASE}/api/learning-paths/${cp._id}/test/submit`, { method: 'POST', headers: auth, body: JSON.stringify({ answers: [] }) })).json();
    assert(cfail.success && cfail.passed === false, 'empty coding submit fails the gate');
  }

  console.log(`\nPHASE 2 HTTP SMOKE: ALL ${okN} CHECKS PASSED`);
  await LearningPath.deleteMany({ _id: { $in: created } });
  await mongoose.disconnect();
})().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
