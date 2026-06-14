// Throwaway P9a HTTP smoke: exercises the REAL /interview-game/submit-round
// handler (not an inlined copy) to prove BOTH GD branches:
//   1. a valid GDSession score beats a forged client aiScore, and
//   2. with NO session, the server falls back to a bounded participation FLOOR
//      (not 0 → no catastrophic elimination, and not the client's number).
// Run against a server started with the local-mongo override:
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" PORT=5055 node server.js
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" SMOKE_BASE=http://localhost:5055 node seeds/verifyP9aGDHttp.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const GDSession = require('../models/GDSession');
const InterviewGame = require('../models/InterviewGame');

const BASE = process.env.SMOKE_BASE || 'http://localhost:5000';
const EMAIL = process.env.SMOKE_EMAIL || 'aditya@prism.dev';
const PASS = process.env.SMOKE_PASS || 'password123';
const GD_PASS = 40; // ROUNDS gd passScore (client + server agree)
const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log(`ok — ${m}`); };

const mkGame = (userId) => InterviewGame.create({
  user: userId, difficulty: 'medium', rounds: [
    { type: 'aptitude', maxScore: 100 }, { type: 'technical1', maxScore: 100 },
    { type: 'coding', maxScore: 100 }, { type: 'gd', maxScore: 100 },
    { type: 'technical2', maxScore: 100 }, { type: 'hr', maxScore: 100 },
  ],
});

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: EMAIL });
  if (!user) throw new Error(`seed user ${EMAIL} not found — run seedAll`);

  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const lj = await lr.json();
  if (!lj.token) throw new Error('login failed: ' + JSON.stringify(lj));
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${lj.token}` };

  // CASE 1 — valid GDSession (72) + forged aiScore 100 → server must use 72.
  const sess = await GDSession.create({ user: user._id, topic: 'P9A-HTTP', scores: { overall: 72 }, feedback: { verdict: 'Good' } });
  const g1 = await mkGame(user._id);
  const r1 = await (await fetch(`${BASE}/api/interview-game/submit-round`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ gameId: g1._id, roundIndex: 3, answers: [{ contributions: 5, topic: 'x' }], aiScore: 100, gdSessionId: sess._id }),
  })).json();
  assert(r1.success && r1.roundScore === 72, `forged aiScore:100 ignored; server GDSession score 72 used (got ${r1.roundScore})`);
  assert((await GDSession.findById(sess._id)).consumed, 'GDSession marked consumed after use (no replay)');

  // CASE 2 — NO session, forged aiScore 100, contributions 5 → floor 45 (not 100, not 0).
  const g2 = await mkGame(user._id);
  const r2 = await (await fetch(`${BASE}/api/interview-game/submit-round`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ gameId: g2._id, roundIndex: 3, answers: [{ contributions: 5, topic: 'x' }], aiScore: 100 }),
  })).json();
  assert(r2.success && r2.roundScore === 45, `no session → server participation floor 45 (not forged 100, not 0); got ${r2.roundScore}`);
  assert(r2.roundScore >= GD_PASS, `floor 45 clears the GD cutoff ${GD_PASS} → a backend blip does NOT eliminate a participant`);

  console.log('\nP9a GD HTTP SMOKE: ALL CHECKS PASSED');
  await GDSession.deleteMany({ topic: 'P9A-HTTP' });
  await InterviewGame.deleteMany({ _id: { $in: [g1._id, g2._id] } });
  await mongoose.disconnect();
})().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
