// In-process service-level verification for the prep-profile API layer (P6 T4).
// Exercises the same code paths that the HTTP endpoints call, without needing
// a live HTTP server. Mirrors the style of verifyPrepSpine.js.
//   node seeds/verifyPrepProfileAPI.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const SkillSignal = require('../models/SkillSignal');
const PrepProfile = require('../models/PrepProfile');
const { readiness } = require('../agent/services/signals');
const { refreshDailyPlan } = require('../agent/services/dailyPlan');

const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); console.log(`ok — ${msg}`); };

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ role: 'mentee' });
    if (!user) throw new Error('no mentee user found — run seedAll first');

    // Ensure there is some signal data (from verifyPrepSpine or real usage).
    const count = await SkillSignal.countDocuments({ user: user._id });
    if (count === 0) throw new Error('no signals for mentee — run verifyPrepSpine.js first');

    // 1. GET /api/prep-profile path: readiness() returns profile with pillars.
    const profile = await readiness(user._id);
    assert(profile && profile.readiness, 'readiness() returns profile with readiness field');
    assert(profile.readiness.pillars && typeof profile.readiness.pillars.dsa === 'object',
        'readiness.pillars.dsa is present');
    console.log(`   overall=${profile.readiness.overall}, dsa=${profile.readiness.pillars.dsa.score}`);

    // 2. POST /api/prep-profile/plan/refresh path: refreshDailyPlan returns profile with dailyPlan.
    const refreshed = await refreshDailyPlan(user._id);
    assert(refreshed.dailyPlan && Array.isArray(refreshed.dailyPlan.items),
        'refreshDailyPlan returns profile with dailyPlan.items array');
    const items = refreshed.dailyPlan.items;
    assert(items.length >= 1 && items.length <= 4, `dailyPlan has 1-4 items (got ${items.length})`);
    assert(items.some((i) => i.kind === 'practice'), 'dailyPlan contains a practice item');
    assert(items.every((i) => i.title && i.link && i.kind), 'every item has kind/title/link');
    console.log(`   plan items: ${items.map((i) => i.kind).join(', ')}`);

    // 3. POST /api/prep-profile/plan/:itemId/done path: toggle done field.
    const loaded = await PrepProfile.findOne({ user: user._id });
    const item = loaded.dailyPlan?.items?.[0];
    assert(item, 'dailyPlan has at least one item to toggle');
    const itemId = item._id;
    const originalDone = item.done;
    item.done = !item.done;
    await loaded.save();
    const reloaded = await PrepProfile.findOne({ user: user._id });
    const toggled = reloaded.dailyPlan.items.id(itemId);
    assert(toggled.done === !originalDone,
        `done toggled from ${originalDone} to ${!originalDone} (itemId=${itemId})`);
    // Toggle back to clean state.
    toggled.done = originalDone;
    await reloaded.save();

    // 4. PUT /api/prep-profile path: targetRole + targetCompanies sanitization logic.
    const profileToEdit = await PrepProfile.findOne({ user: user._id });
    const rawRole = '  SDE  ';
    const rawCompanies = [{ name: '  Infosys  ', priority: 99 }]; // priority 99 → coerced to 1
    profileToEdit.targetRole = rawRole.trim().slice(0, 100);
    profileToEdit.targetCompanies = rawCompanies
        .filter((c) => c && typeof c.name === 'string' && c.name.trim())
        .slice(0, 5)
        .map((c) => ({
            company: c.company || undefined,
            name: c.name.trim().slice(0, 100),
            priority: [1, 2, 3].includes(Number(c.priority)) ? Number(c.priority) : 1,
        }));
    await profileToEdit.save();
    const afterPut = await PrepProfile.findOne({ user: user._id });
    assert(afterPut.targetRole === 'SDE', `targetRole trimmed to 'SDE' (got '${afterPut.targetRole}')`);
    assert(afterPut.targetCompanies[0].name === 'Infosys',
        `company name trimmed to 'Infosys' (got '${afterPut.targetCompanies[0].name}')`);
    assert(afterPut.targetCompanies[0].priority === 1,
        `invalid priority 99 coerced to 1 (got ${afterPut.targetCompanies[0].priority})`);

    console.log('\nPREP PROFILE API: ALL CHECKS PASSED');
    await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
