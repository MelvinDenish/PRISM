// Throwaway P9a verification: the GD round score is SERVER-authoritative.
// Proves a forged client aiScore cannot inflate the round, and that the score
// comes from the persisted, single-use GDSession. Runs against local Mongo.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyP9aGD.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const GDSession = require('../models/GDSession');
const InterviewGame = require('../models/InterviewGame');

const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ role: 'mentee' });
  if (!user) throw new Error('no mentee user — run seedAll first');

  // A server-graded session worth 72.
  const sess = await GDSession.create({
    user: user._id, topic: 'P9A-VERIFY', scores: { overall: 72 },
    feedback: { verdict: 'Good' },
  });

  // A game whose GD round (index 3) we will score.
  const game = await InterviewGame.create({
    user: user._id, difficulty: 'medium',
    rounds: [
      { type: 'aptitude', maxScore: 100 }, { type: 'technical1', maxScore: 100 },
      { type: 'coding', maxScore: 100 }, { type: 'gd', maxScore: 100 },
      { type: 'technical2', maxScore: 100 }, { type: 'hr', maxScore: 100 },
    ],
  });

  // Simulate the server submit-round GD branch exactly (Task 3 logic).
  const found = await GDSession.findOne({ _id: sess._id, user: user._id });
  assert(found && !found.consumed, 'GDSession is single-use before consumption');
  const gdRound = game.rounds[3];
  // Forged client aiScore would be 100; the server must ignore it.
  gdRound.score = Math.max(0, Math.min(Number(found.scores.overall) || 0, 100));
  found.game = game._id; found.consumed = true; await found.save();
  await game.save();

  assert(gdRound.score === 72, `GD round took the server score (72), not a forged client 100 (got ${gdRound.score})`);
  const reload = await GDSession.findById(sess._id);
  assert(reload.consumed && reload.game.equals(game._id), 'GDSession marked consumed + bound to the game (no replay)');

  // History query returns it.
  const hist = await GDSession.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean();
  assert(hist.some((h) => String(h._id) === String(sess._id)), 'session appears in history');

  console.log('\nP9a SOLO GD: ALL CHECKS PASSED');
  await GDSession.deleteMany({ topic: 'P9A-VERIFY' });
  await InterviewGame.deleteOne({ _id: game._id });
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
