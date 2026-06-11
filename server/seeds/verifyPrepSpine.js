// Throwaway P6 verification: seeds synthetic signals for a real mentee and
// asserts the readiness math (decay, weights, trend, overall) behaves.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyPrepSpine.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const SkillSignal = require('../models/SkillSignal');
const PrepProfile = require('../models/PrepProfile');
const { emit, readiness } = require('../agent/services/signals');

const DAY_MS = 24 * 60 * 60 * 1000;
const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`ok — ${msg}`); };

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ role: 'mentee' });
    if (!user) throw new Error('no mentee user found — run seedAll first');

    // Clean slate for this user.
    await SkillSignal.deleteMany({ user: user._id });
    await PrepProfile.deleteMany({ user: user._id });

    // 1. Recent strong DSA evidence vs old weak evidence → decay favors recent.
    await emit(user._id, [
        { pillar: 'dsa', skill: 'arrays', score: 0.2, source: 'coding', at: new Date(Date.now() - 60 * DAY_MS) },
        { pillar: 'dsa', skill: 'arrays', score: 0.9, source: 'coding' },
    ]);
    let profile = await PrepProfile.findOne({ user: user._id });
    assert(profile, 'profile auto-created on first emit');
    const dsa = profile.readiness.pillars.dsa;
    assert(dsa.sampleCount === 2, `dsa sampleCount is 2 (got ${dsa.sampleCount})`);
    assert(dsa.score > 70, `decay favors the recent 0.9 over the 60-day-old 0.2 (got ${dsa.score})`);

    // 2. Source weights: one high-weight mentor signal should move communication
    //    more than one low-weight gd_live signal at the same score distance.
    await emit(user._id, [
        { pillar: 'communication', skill: 'hr', score: 0.5, source: 'gd_live' },
        { pillar: 'communication', skill: 'hr', score: 1.0, source: 'mentor_feedback' },
    ]);
    profile = await PrepProfile.findOne({ user: user._id });
    const comm = profile.readiness.pillars.communication;
    assert(comm.score > 75, `mentor_feedback (w=3) dominates gd_live (w=0.5): score ${comm.score} > 75`);

    // 3. Overall excludes no-data pillars (aptitude/cs_core/resume have none).
    assert(profile.readiness.pillars.aptitude.sampleCount === 0, 'aptitude has no data');
    const expectedOverall = Math.round((dsa.score + comm.score) / 2);
    assert(Math.abs(profile.readiness.overall - expectedOverall) <= 1,
        `overall ≈ mean of pillars WITH data (${profile.readiness.overall} ≈ ${expectedOverall})`);

    // 4. Invalid signals are dropped silently, valid request never throws.
    const out = await emit(user._id, [{ pillar: 'nonsense', score: 5, source: 'coding' }]);
    assert(out === null, 'invalid-only batch is a no-op, not an error');

    // 5. Full recompute path.
    profile = await readiness(user._id);
    assert(profile.readiness.pillars.dsa.score === dsa.score, 'readiness() recompute matches emit-time compute');

    console.log('\nPREP SPINE SIGNALS: ALL CHECKS PASSED');
    await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
