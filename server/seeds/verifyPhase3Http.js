// Phase 3 HTTP smoke — mentor upload flow + "mentor upload appears in the next game".
// Boot a server against local mongo first:
//   PORT=5057 node server.js
//   SMOKE_BASE=http://localhost:5057 node seeds/verifyPhase3Http.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const QuestionBank = require('../models/QuestionBank');
const InterviewGame = require('../models/InterviewGame');

const BASE = process.env.SMOKE_BASE || 'http://localhost:5000';
const MENTOR = process.env.SMOKE_MENTOR || 'rahul.mentor@prism.dev';
const MENTEE = process.env.SMOKE_MENTEE || 'aditya@prism.dev';
const PASS = process.env.SMOKE_PASS || 'password123';
let okN = 0;
const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); okN++; console.log(`ok — ${m}`); };

const login = async (email) => {
  const j = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASS }) })).json();
  if (!j.token) throw new Error(`login failed for ${email}: ${JSON.stringify(j)}`);
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${j.token}` };
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const company = await Company.findOne({});
  const mentee = await User.findOne({ email: MENTEE });
  await QuestionBank.deleteMany({ category: 'P3HTTP' });

  const mentorAuth = await login(MENTOR);
  const menteeAuth = await login(MENTEE);

  // 1. Mentor uploads a company-tagged MCQ.
  const mcq = await (await fetch(`${BASE}/api/question-bank`, { method: 'POST', headers: mentorAuth, body: JSON.stringify({
    type: 'technical', companyTag: company._id, category: 'P3HTTP', difficulty: 'medium',
    q: 'P3HTTP: Which structure backs a BFS traversal?', opts: ['Queue', 'Stack', 'Heap', 'Tree'], ans: 'Queue',
  }) })).json();
  assert(mcq.success && mcq.question?.source === 'mentor' && String(mcq.question.companyTag) === String(company._id), 'mentor MCQ saved with source:mentor + companyTag');
  const mcqId = mcq.question._id;

  // 2. Invalid MCQ (ans not among opts) is rejected.
  const bad = await fetch(`${BASE}/api/question-bank`, { method: 'POST', headers: mentorAuth, body: JSON.stringify({ type: 'technical', q: 'bad', opts: ['a', 'b'], ans: 'z', category: 'P3HTTP' }) });
  assert(bad.status === 400, 'invalid MCQ (ans not in opts) rejected with 400');

  // 3. Coding question is reference-verified before it is accepted.
  const coding = await (await fetch(`${BASE}/api/question-bank`, { method: 'POST', headers: mentorAuth, body: JSON.stringify({
    type: 'coding', companyTag: company._id, category: 'P3HTTP', difficulty: 'easy',
    title: 'P3HTTP Sum Two', description: 'Read two ints, print their sum.',
    referenceSolution: 'a,b=map(int,input().split())\nprint(a+b)',
    testInputs: ['2 3', '10 20', '-1 1'],
  }) })).json();
  assert(coding.success && coding.question.testCases.length === 3 && coding.question.testCases[0].expectedOutput === '5', 'coding question reference-verified (expected outputs computed)');

  // 4. A bad coding reference (cannot run) is rejected.
  const badCode = await fetch(`${BASE}/api/question-bank`, { method: 'POST', headers: mentorAuth, body: JSON.stringify({ type: 'coding', title: 'x', description: 'y', referenceSolution: 'this is not python', testInputs: ['1'], category: 'P3HTTP' }) });
  assert(badCode.status === 400, 'unverifiable coding reference rejected with 400');

  // 5. A mentee cannot upload (authz gate).
  const forbidden = await fetch(`${BASE}/api/question-bank`, { method: 'POST', headers: menteeAuth, body: JSON.stringify({ type: 'hr', q: 'nope', category: 'P3HTTP' }) });
  assert(forbidden.status === 403, 'mentee is forbidden from uploading (403)');

  // 6. Mentor list shows the uploads.
  const list = await (await fetch(`${BASE}/api/question-bank?companyTag=${company._id}`, { headers: mentorAuth })).json();
  assert(list.success && list.questions.some((q) => String(q._id) === String(mcqId)), 'mentor GET lists the uploaded question');

  // 7. The mentor upload appears in a mentee's company-targeted game.
  const start = await (await fetch(`${BASE}/api/interview-game/start`, { method: 'POST', headers: menteeAuth, body: JSON.stringify({ companyFocus: company._id }) })).json();
  assert(start.success, 'mentee starts a company-targeted game');
  const gameId = start.game._id;
  await (await fetch(`${BASE}/api/interview-game/questions/technical1?gameId=${gameId}`, { headers: menteeAuth })).json();
  const dbGame = await InterviewGame.findById(gameId).lean();
  const t1 = dbGame.rounds.find((r) => r.type === 'technical1');
  const served = (t1.servedQuestions || []).map((s) => String(s.bankId));
  assert(served.includes(String(mcqId)), 'the mentor-uploaded question was served into the targeted game (preferred)');

  // Cleanup
  await QuestionBank.deleteMany({ category: 'P3HTTP' });
  await InterviewGame.deleteOne({ _id: gameId });
  console.log(`\nPHASE 3 HTTP SMOKE: ALL ${okN} CHECKS PASSED`);
  await mongoose.disconnect();
})().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
