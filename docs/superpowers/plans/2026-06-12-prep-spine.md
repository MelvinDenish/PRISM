# Prep Spine (Phase 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the target-first signal spine — `PrepProfile` + append-only `SkillSignal` + deterministic readiness/daily-plan services — and wire every existing scored route to emit into it.

**Architecture:** Two new Mongoose models; two new services in `server/agent/services/` (the repo's routes-and-agent-shared layer); one new route file; one-line `emit()` hooks in five existing routes. Scoring is deterministic (time-decayed weighted mean) — **no LLM anywhere in this phase**. Signal emission is best-effort: it must never fail the parent request.

**Tech Stack:** Express 4 + Mongoose (CommonJS), existing `protect`/`authorize` middleware, existing `{ success, ... }` response shape, axios wrappers in `client/src/services/api.js`. No test runner exists in this repo — verification uses a `server/seeds/verifyPrepSpine.js` script run against local Docker Mongo (`mongodb://127.0.0.1:27017/prism` — Atlas is dead, see `memory/dev-db-setup.md`), matching the existing `seeds/verify*.js` pattern.

**Spec:** `docs/superpowers/specs/2026-06-12-prepare-architecture-design.md`

**Conventions that apply to every task:**
- CommonJS (`require`/`module.exports`) on server, ESM on client.
- All new endpoints return `{ success: boolean, ...data, message? }`; errors use the existing per-route try/catch style.
- Run verification scripts from `server/`: `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; node seeds/verifyPrepSpine.js` (PowerShell) or `MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyPrepSpine.js` (bash).
- One commit per task, message style `feat(spine): …`.

---

### Task 1: SkillSignal + PrepProfile models

**Files:**
- Create: `server/models/SkillSignal.js`
- Create: `server/models/PrepProfile.js`

- [ ] **Step 1: Create `server/models/SkillSignal.js`**

```js
const mongoose = require('mongoose');

// The five readiness pillars. Fixed taxonomy — every scored activity in the app
// maps onto exactly one of these (spec: prepare-architecture overhaul, P6).
const PILLARS = ['aptitude', 'dsa', 'cs_core', 'communication', 'resume'];

const SOURCES = [
    'interview_game', 'coding', 'ai_interview', 'gd_solo', 'gd_live',
    'review', 'resume_analysis', 'diagnostic', 'mentor_feedback',
];

// Append-only event log: one row = one piece of scored evidence about a skill.
// Readiness is always recomputed FROM these rows (never mutated in place), so
// scoring-logic changes can rescore history for free.
const skillSignalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pillar: { type: String, enum: PILLARS, required: true },
    skill: { type: String, default: '' },          // free tag: 'arrays', 'dbms', 'hr'
    score: { type: Number, min: 0, max: 1, required: true },
    weight: { type: Number, default: 1 },          // source trust, see SOURCE_WEIGHTS
    source: { type: String, enum: SOURCES, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    at: { type: Date, default: Date.now },
});

// Readiness reads: all of one user's signals for a pillar, newest first.
skillSignalSchema.index({ user: 1, pillar: 1, at: -1 });

module.exports = mongoose.model('SkillSignal', skillSignalSchema);
module.exports.PILLARS = PILLARS;
module.exports.SOURCES = SOURCES;
```

- [ ] **Step 2: Create `server/models/PrepProfile.js`**

```js
const mongoose = require('mongoose');

const pillarStateSchema = new mongoose.Schema({
    score: { type: Number, default: 0 },           // 0–100
    trend: { type: String, enum: ['up', 'flat', 'down'], default: 'flat' },
    sampleCount: { type: Number, default: 0 },
    updatedAt: Date,
}, { _id: false });

const planItemSchema = new mongoose.Schema({
    kind: { type: String, enum: ['review', 'practice', 'session', 'resume'], required: true },
    title: { type: String, required: true },
    link: { type: String, required: true },        // client route, e.g. '/review'
    reason: { type: String, default: '' },
    done: { type: Boolean, default: false },
});

// One per mentee. Created lazily by services/signals.ensureProfile() — there is
// no migration; existing users get a profile on first read.
const prepProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    targetRole: { type: String, default: '' },
    targetCompanies: [{
        company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
        name: { type: String, required: true },
        priority: { type: Number, default: 1, min: 1, max: 3 },
    }],
    timeline: { firstInterviewAt: Date },
    // Derived cache — recomputed by services/signals on every emit. The SkillSignal
    // collection is the source of truth; never hand-edit these numbers.
    readiness: {
        overall: { type: Number, default: 0 },
        pillars: {
            aptitude: { type: pillarStateSchema, default: () => ({}) },
            dsa: { type: pillarStateSchema, default: () => ({}) },
            cs_core: { type: pillarStateSchema, default: () => ({}) },
            communication: { type: pillarStateSchema, default: () => ({}) },
            resume: { type: pillarStateSchema, default: () => ({}) },
        },
    },
    dailyPlan: {
        date: Date,
        items: [planItemSchema],
        generatedAt: Date,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PrepProfile', prepProfileSchema);
```

- [ ] **Step 3: Smoke-check the models load**

Run from `server/`: `node -e "require('./models/SkillSignal'); require('./models/PrepProfile'); console.log('models OK')"`
Expected: `models OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/SkillSignal.js server/models/PrepProfile.js
git commit -m "feat(spine): P6 — SkillSignal + PrepProfile models"
```

---

### Task 2: signals service (emit + readiness)

**Files:**
- Create: `server/agent/services/signals.js`
- Create: `server/seeds/verifyPrepSpine.js`

- [ ] **Step 1: Create `server/agent/services/signals.js`**

```js
// Signal spine core: emit() appends evidence and recomputes readiness onto the
// user's PrepProfile. Deterministic — no LLM. Shared by HTTP routes and agent
// tools (same pattern as the other services in this directory).
const SkillSignal = require('../../models/SkillSignal');
const { PILLARS } = require('../../models/SkillSignal');
const PrepProfile = require('../../models/PrepProfile');
const User = require('../../models/User');
const logger = require('../../utils/logger');

// Source trust weights (spec §signals service). A mentor's judgement outweighs
// a self-graded live-GD guess by 6x.
const SOURCE_WEIGHTS = {
    mentor_feedback: 3,
    ai_interview: 2.5,
    gd_solo: 2,
    interview_game: 1.5,
    coding: 1.5,
    diagnostic: 1.5,
    resume_analysis: 1,
    review: 0.75,
    gd_live: 0.5,
};

const HALF_LIFE_DAYS = 14;   // a 2-week-old signal counts half
const HORIZON_DAYS = 90;     // older signals are ignored entirely
const DAY_MS = 24 * 60 * 60 * 1000;

// Get-or-create the user's PrepProfile, seeded from existing User fields so
// current users need no migration.
async function ensureProfile(userId) {
    let profile = await PrepProfile.findOne({ user: userId });
    if (profile) return profile;
    const user = await User.findById(userId).select('aimingCompany');
    profile = new PrepProfile({
        user: userId,
        targetCompanies: user?.aimingCompany ? [{ name: user.aimingCompany, priority: 1 }] : [],
    });
    try {
        await profile.save();
    } catch (err) {
        // Race on first parallel request: the unique index wins — re-read.
        if (err.code === 11000) return PrepProfile.findOne({ user: userId });
        throw err;
    }
    return profile;
}

const decayFactor = (at, now) => Math.pow(0.5, (now - at) / DAY_MS / HALF_LIFE_DAYS);

// Decay-weighted mean over the horizon → { score 0-100, trend, sampleCount }.
async function computePillar(userId, pillar, now = new Date()) {
    const since = new Date(now.getTime() - HORIZON_DAYS * DAY_MS);
    const signals = await SkillSignal
        .find({ user: userId, pillar, at: { $gte: since } })
        .select('score weight at').lean();
    if (!signals.length) return { score: 0, trend: 'flat', sampleCount: 0, updatedAt: now };

    let num = 0, den = 0;
    for (const s of signals) {
        const w = (s.weight || 1) * decayFactor(s.at, now);
        num += s.score * w;
        den += w;
    }
    const score = Math.round((num / den) * 100);

    // Trend: plain (undecayed) mean of the last 7 days vs the 21 days before it.
    const split = now.getTime() - 7 * DAY_MS;
    const recent = signals.filter((s) => s.at.getTime() >= split);
    const prior = signals.filter((s) => s.at.getTime() < split);
    let trend = 'flat';
    if (recent.length >= 2 && prior.length >= 2) {
        const mean = (arr) => arr.reduce((a, s) => a + s.score, 0) / arr.length;
        const delta = (mean(recent) - mean(prior)) * 100;
        if (delta > 5) trend = 'up';
        else if (delta < -5) trend = 'down';
    }
    return { score, trend, sampleCount: signals.length, updatedAt: now };
}

// Overall = mean of pillars that have data; pillars with no samples are excluded
// (the UI shows them as "no data yet" rather than dragging the average to 0).
function overallFrom(pillars) {
    const withData = PILLARS
        .map((p) => pillars[p])
        .filter((s) => s && s.sampleCount > 0);
    if (!withData.length) return 0;
    return Math.round(withData.reduce((a, s) => a + s.score, 0) / withData.length);
}

// Append signals and refresh the affected pillars. BEST-EFFORT: never throws —
// the calling route's result (game score, submission, …) is canonical and must
// not fail because scoring bookkeeping did.
async function emit(userId, signals) {
    try {
        const docs = (Array.isArray(signals) ? signals : [])
            .filter((s) => s && PILLARS.includes(s.pillar) && Number.isFinite(Number(s.score)))
            .map((s) => ({
                user: userId,
                pillar: s.pillar,
                skill: typeof s.skill === 'string' ? s.skill.slice(0, 60) : '',
                score: Math.max(0, Math.min(1, Number(s.score))),
                weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : (SOURCE_WEIGHTS[s.source] || 1),
                source: s.source,
                sourceId: s.sourceId,
                at: s.at || new Date(),
            }));
        if (!docs.length) return null;

        await SkillSignal.insertMany(docs);
        const profile = await ensureProfile(userId);
        const touched = [...new Set(docs.map((d) => d.pillar))];
        for (const pillar of touched) {
            profile.readiness.pillars[pillar] = await computePillar(userId, pillar);
        }
        profile.readiness.overall = overallFrom(profile.readiness.pillars);
        profile.updatedAt = new Date();
        await profile.save();
        return profile;
    } catch (err) {
        logger.warn('signal_emit_failed', { userId: String(userId), err: err.message });
        return null;
    }
}

// Full recompute of all five pillars (used by GET /prep-profile so a stale
// cache self-heals, and by the verify script).
async function readiness(userId) {
    const profile = await ensureProfile(userId);
    for (const pillar of PILLARS) {
        profile.readiness.pillars[pillar] = await computePillar(userId, pillar);
    }
    profile.readiness.overall = overallFrom(profile.readiness.pillars);
    profile.updatedAt = new Date();
    await profile.save();
    return profile;
}

module.exports = { emit, readiness, ensureProfile, SOURCE_WEIGHTS, HALF_LIFE_DAYS, HORIZON_DAYS };
```

- [ ] **Step 2: Create the verify script `server/seeds/verifyPrepSpine.js`**

```js
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
```

- [ ] **Step 3: Run the verify script — expect all checks pass**

Run from `server/` (PowerShell): `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; node seeds/verifyPrepSpine.js`
Expected: five `ok — …` lines then `PREP SPINE SIGNALS: ALL CHECKS PASSED`. (Requires the local Docker Mongo from `memory/dev-db-setup.md` and seeded users via `node seeds/seedAll.js`.)

- [ ] **Step 4: Commit**

```bash
git add server/agent/services/signals.js server/seeds/verifyPrepSpine.js
git commit -m "feat(spine): P6 — signals service (decay-weighted readiness) + verify script"
```

---

### Task 3: dailyPlan service

**Files:**
- Create: `server/agent/services/dailyPlan.js`
- Modify: `server/seeds/verifyPrepSpine.js` (append a check)

- [ ] **Step 1: Create `server/agent/services/dailyPlan.js`**

```js
// Rule-based daily plan — deterministic, no LLM (spec §dailyPlan). Priority:
// due reviews → weakest measured pillar → upcoming session prep → resume gap.
// Capped at 4 items. The Copilot's get_daily_plan tool (P11) reads this same
// function, so chat and dashboard can never disagree.
const ReviewItem = require('../../models/ReviewItem');
const MentorshipSession = require('../../models/MentorshipSession');
const { PILLARS } = require('../../models/SkillSignal');
const { ensureProfile } = require('./signals');

const MAX_ITEMS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

const PILLAR_ACTIONS = {
    aptitude: { title: 'Play an aptitude round in the Interview Game', link: '/interview-game' },
    dsa: { title: 'Solve 2 coding questions', link: '/coding-questions' },
    cs_core: { title: 'Take a technical MCQ round in the Interview Game', link: '/interview-game' },
    communication: { title: 'Run a mock HR interview', link: '/interview-game' },
    resume: { title: 'Run an ATS check on your resume', link: '/resume-builder' },
};

async function buildDailyPlan(userId) {
    const profile = await ensureProfile(userId);
    const now = new Date();
    const items = [];

    // 1. Due spaced-repetition reviews always come first.
    const dueCount = await ReviewItem.countDocuments({ user: userId, mastered: false, dueAt: { $lte: now } });
    if (dueCount > 0) {
        items.push({
            kind: 'review',
            title: `Clear ${dueCount} due review item${dueCount === 1 ? '' : 's'}`,
            link: '/review',
            reason: 'Spaced repetition only works when reviews happen on schedule.',
        });
    }

    // 2. Weakest measured pillar → one concrete practice action.
    const measured = PILLARS
        .map((p) => ({ pillar: p, state: profile.readiness.pillars[p] }))
        .filter((x) => x.state && x.state.sampleCount > 0)
        .sort((a, b) => a.state.score - b.state.score);
    if (measured.length > 0) {
        const weakest = measured[0];
        const action = PILLAR_ACTIONS[weakest.pillar];
        items.push({
            kind: 'practice',
            title: action.title,
            link: action.link,
            reason: `${weakest.pillar.replace('_', ' ')} is your weakest pillar right now (${weakest.state.score}/100).`,
        });
    } else {
        items.push({
            kind: 'practice',
            title: 'Play a full Interview Game to baseline your readiness',
            link: '/interview-game',
            reason: 'No activity data yet — one full game measures every pillar at once.',
        });
    }

    // 3. A mentor session in the next 48h → prepare for it.
    const upcoming = await MentorshipSession.findOne({
        mentee: userId,
        status: { $nin: ['completed', 'cancelled'] },
        scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 2 * DAY_MS) },
    }).sort({ scheduledDate: 1 }).populate('mentor', 'name');
    if (upcoming) {
        items.push({
            kind: 'session',
            title: `Prepare for your session with ${upcoming.mentor?.name || 'your mentor'}`,
            link: '/sessions',
            reason: 'Write down 3 questions — mentor time is your highest-value input.',
        });
    }

    // 4. Resume pillar has no evidence yet → nudge an ATS check.
    const resumeState = profile.readiness.pillars.resume;
    if ((!resumeState || resumeState.sampleCount === 0) && !items.some((i) => i.kind === 'resume')) {
        items.push({
            kind: 'resume',
            title: 'Run an ATS check on your resume',
            link: '/resume-builder',
            reason: 'No resume score on record — one check fills in the fifth readiness pillar.',
        });
    }

    return items.slice(0, MAX_ITEMS);
}

// Build and persist onto the profile (returns the saved profile).
async function refreshDailyPlan(userId) {
    const profile = await ensureProfile(userId);
    const items = await buildDailyPlan(userId);
    profile.dailyPlan = { date: new Date(), items, generatedAt: new Date() };
    profile.updatedAt = new Date();
    await profile.save();
    return profile;
}

module.exports = { buildDailyPlan, refreshDailyPlan, MAX_ITEMS };
```

- [ ] **Step 2: Append a daily-plan check to `server/seeds/verifyPrepSpine.js`**

Insert **before** the final `console.log('\nPREP SPINE SIGNALS: ALL CHECKS PASSED');` line:

```js
    // 6. Daily plan: rule-based, ≤4 items, weakest measured pillar appears.
    const { refreshDailyPlan } = require('../agent/services/dailyPlan');
    profile = await refreshDailyPlan(user._id);
    const plan = profile.dailyPlan;
    assert(plan.items.length > 0 && plan.items.length <= 4, `plan has 1-4 items (got ${plan.items.length})`);
    assert(plan.items.some((i) => i.kind === 'practice'), 'plan contains a practice item');
    assert(plan.items.every((i) => i.title && i.link && i.kind), 'every item has kind/title/link');
```

- [ ] **Step 3: Re-run the verify script**

Run from `server/`: `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; node seeds/verifyPrepSpine.js`
Expected: previous checks plus three new `ok — …` lines, then `PREP SPINE SIGNALS: ALL CHECKS PASSED`.

- [ ] **Step 4: Commit**

```bash
git add server/agent/services/dailyPlan.js server/seeds/verifyPrepSpine.js
git commit -m "feat(spine): P6 — rule-based daily plan service"
```

---

### Task 4: prep-profile API + client wrappers

**Files:**
- Create: `server/routes/prepProfile.js`
- Modify: `server/server.js` (route registration, after line 65 `app.use('/api/assistant', …)`)
- Modify: `client/src/services/api.js` (append named exports)

- [ ] **Step 1: Create `server/routes/prepProfile.js`**

```js
const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { ensureProfile, readiness } = require('../agent/services/signals');
const { refreshDailyPlan } = require('../agent/services/dailyPlan');
const router = express.Router();

const fail = (res, err) => res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
});

// GET /api/prep-profile — auto-creates and self-heals (full recompute is cheap
// at per-user signal volumes; it also backfills profiles for pre-spine users).
router.get('/', protect, authorize('mentee'), async (req, res) => {
    try {
        const profile = await readiness(req.user._id);
        res.json({ success: true, profile });
    } catch (err) { fail(res, err); }
});

// PUT /api/prep-profile — edit target role/companies/timeline only.
// Readiness and dailyPlan are derived — never writable from the client.
router.put('/', protect, authorize('mentee'), async (req, res) => {
    try {
        const profile = await ensureProfile(req.user._id);
        const { targetRole, targetCompanies, firstInterviewAt } = req.body;
        if (typeof targetRole === 'string') profile.targetRole = targetRole.trim().slice(0, 100);
        if (Array.isArray(targetCompanies)) {
            profile.targetCompanies = targetCompanies
                .filter((c) => c && typeof c.name === 'string' && c.name.trim())
                .slice(0, 5)
                .map((c) => ({
                    company: c.company || undefined,
                    name: c.name.trim().slice(0, 100),
                    priority: [1, 2, 3].includes(Number(c.priority)) ? Number(c.priority) : 1,
                }));
        }
        if (firstInterviewAt !== undefined) {
            const d = firstInterviewAt ? new Date(firstInterviewAt) : null;
            profile.timeline.firstInterviewAt = d && !Number.isNaN(d.getTime()) ? d : undefined;
        }
        profile.updatedAt = new Date();
        await profile.save();
        res.json({ success: true, profile });
    } catch (err) { fail(res, err); }
});

// POST /api/prep-profile/plan/refresh — regenerate today's plan.
router.post('/plan/refresh', protect, authorize('mentee'), async (req, res) => {
    try {
        const profile = await refreshDailyPlan(req.user._id);
        res.json({ success: true, dailyPlan: profile.dailyPlan });
    } catch (err) { fail(res, err); }
});

// POST /api/prep-profile/plan/:itemId/done — toggle one plan item.
router.post('/plan/:itemId/done', protect, authorize('mentee'), async (req, res) => {
    try {
        const profile = await ensureProfile(req.user._id);
        const item = profile.dailyPlan?.items?.id(req.params.itemId);
        if (!item) return res.status(404).json({ success: false, message: 'Plan item not found' });
        item.done = !item.done;
        await profile.save();
        res.json({ success: true, dailyPlan: profile.dailyPlan });
    } catch (err) { fail(res, err); }
});

module.exports = router;
```

- [ ] **Step 2: Register the route in `server/server.js`**

After line 65 (`app.use('/api/assistant', require('./routes/assistant'));`) add:

```js
app.use('/api/prep-profile', require('./routes/prepProfile'));
```

- [ ] **Step 3: Add client wrappers at the end of `client/src/services/api.js`**

```js
// ── Prep profile / readiness spine (P6) ──
export const getPrepProfile = () => api.get('/prep-profile');
export const updatePrepProfile = (data) => api.put('/prep-profile', data);
export const refreshDailyPlan = () => api.post('/prep-profile/plan/refresh');
export const toggleDailyPlanItem = (itemId) => api.post(`/prep-profile/plan/${itemId}/done`);
```

(Match the file's existing export style — if it exports wrappers via a default object instead of named exports, follow that file's pattern.)

- [ ] **Step 4: Verify the endpoints live**

1. Start the server: from `server/` run `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; npm run dev`
2. Get a mentee token: `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; node seeds/verifyReviewQueue.js` (prints `token`)
3. `curl -s -H "Authorization: Bearer <token>" http://localhost:5000/api/prep-profile`
   Expected: `{"success":true,"profile":{...readiness with the Task 2/3 seeded scores...}}`
4. `curl -s -X POST -H "Authorization: Bearer <token>" http://localhost:5000/api/prep-profile/plan/refresh`
   Expected: `{"success":true,"dailyPlan":{"items":[...1-4 items...]}}`
5. `curl -s -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"targetRole\":\"SDE\",\"targetCompanies\":[{\"name\":\"Infosys\"}]}" http://localhost:5000/api/prep-profile`
   Expected: profile echoes `targetRole: "SDE"`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/prepProfile.js server/server.js client/src/services/api.js
git commit -m "feat(spine): P6 — prep-profile API + client wrappers"
```

---

### Task 5: emit from Interview Game rounds

**Files:**
- Modify: `server/routes/interviewGame.js` (require at top; hook in `POST /submit-round` after the round is scored, around line 446-448)

- [ ] **Step 1: Add the require near the top of `server/routes/interviewGame.js`** (next to the other requires, after line 7):

```js
const { emit: emitSignals } = require('../agent/services/signals');
```

- [ ] **Step 2: Add the pillar map near `MCQ_ROUNDS` (after line 14)**

```js
// P6 spine: which readiness pillar each game round feeds.
const PILLAR_BY_ROUND = {
    aptitude: 'aptitude',
    technical1: 'cs_core',
    technical2: 'cs_core',
    coding: 'dsa',
    hr: 'communication',
    gd: 'communication',
};
```

- [ ] **Step 3: Emit after the round score is finalized**

In `POST /submit-round`, directly after these existing lines (~446-448):

```js
    round.score = Math.max(0, Math.min(score, 100));
    round.status = 'completed';
    round.completedAt = new Date();
```

add:

```js
    // P6 spine: report this round as skill evidence (best-effort, never throws).
    await emitSignals(req.user._id, [{
        pillar: PILLAR_BY_ROUND[roundType] || 'cs_core',
        skill: roundType,
        score: round.score / 100,
        source: 'interview_game',
        sourceId: game._id,
    }]);
```

- [ ] **Step 4: Verify**

With the server running (Task 4 setup): play one game round via the UI (`client/` → `npm run dev` → `/interview-game`) **or** re-use an existing game id with curl. Then:

`curl -s -H "Authorization: Bearer <token>" http://localhost:5000/api/prep-profile`
Expected: the round's pillar shows an increased `sampleCount` and a score consistent with the round result.

- [ ] **Step 5: Commit**

```bash
git add server/routes/interviewGame.js
git commit -m "feat(spine): P6 — interview-game rounds emit pillar signals"
```

---

### Task 6: emit from coding submissions

**Files:**
- Modify: `server/routes/codingQuestions.js` (require at top; hook in `POST /:id/submit` after `CodeSubmission.create`, around line 170)

- [ ] **Step 1: Add the require at the top** (next to existing requires):

```js
const { emit: emitSignals } = require('../agent/services/signals');
```

- [ ] **Step 2: Emit after the submission is persisted**

Directly after the existing `await CodeSubmission.create({ ... });` block (ends ~line 170) add:

```js
        // P6 spine: every graded submission is dsa evidence (category = skill tag).
        await emitSignals(req.user._id, [{
            pillar: 'dsa',
            skill: problem.category || 'coding',
            score: (Number(graded.score) || 0) / 100,
            source: 'coding',
            sourceId: problem._id,
        }]);
```

- [ ] **Step 3: Verify**

Submit any solution on `/coding-questions` (or re-run the curl submit used by `seeds/verifyTrackerE2E.js`), then:
`curl -s -H "Authorization: Bearer <token>" http://localhost:5000/api/prep-profile`
Expected: `readiness.pillars.dsa.sampleCount` increments.

- [ ] **Step 4: Commit**

```bash
git add server/routes/codingQuestions.js
git commit -m "feat(spine): P6 — coding submissions emit dsa signals"
```

---

### Task 7: emit from AI interview evaluations

**Files:**
- Modify: `server/routes/aiInterview.js` (require at top; hook inside the `persist === true` branch of `POST /evaluate`, after `attemptId = attempt._id;` at line 172)

- [ ] **Step 1: Add the require at the top:**

```js
const { emit: emitSignals } = require('../agent/services/signals');
```

- [ ] **Step 2: Emit after the attempt is persisted**

Inside the existing `if (req.body.persist === true && (type === 'technical' || type === 'hr')) { try { ... }` block, directly after `attemptId = attempt._id;` add:

```js
        // P6 spine: only standalone interviews emit (the Interview Game's rounds
        // already emit via /submit-round — persist:false there, no double count).
        await emitSignals(req.user._id, [{
          pillar: type === 'technical' ? 'cs_core' : 'communication',
          skill: typeof req.body.topic === 'string' ? req.body.topic.slice(0, 60) : type,
          score: (Number(evaluation.overallScore) || 0) / 100,
          source: 'ai_interview',
          sourceId: attempt._id,
        }]);
```

(Placement matters: inside the `try` whose `catch` warns `InterviewAttempt save failed` — emission is part of the same best-effort persistence path.)

- [ ] **Step 3: Verify**

Run a standalone AI interview from the UI and finish it (it calls `/evaluate` with `persist:true`), then check `/api/prep-profile`:
Expected: `communication` (hr) or `cs_core` (technical) `sampleCount` increments with a high-weight signal (`ai_interview` w=2.5 — score shifts more than a game round would).

- [ ] **Step 4: Commit**

```bash
git add server/routes/aiInterview.js
git commit -m "feat(spine): P6 — AI interview evaluations emit signals"
```

---

### Task 8: emit from review-queue grades

**Files:**
- Modify: `server/routes/review.js` (require at top; hook in `POST /:id/review` after `await item.save();` at line 150)

- [ ] **Step 1: Add the require at the top:**

```js
const { emit: emitSignals } = require('../agent/services/signals');
```

- [ ] **Step 2: Add the pillar mapper above the route (before line 143)**

```js
// P6 spine: ReviewItem.kind → readiness pillar. MCQ items split on category —
// aptitude-bank questions feed 'aptitude', everything else is core CS.
const pillarForItem = (item) => {
    if (item.kind === 'coding') return 'dsa';
    if (item.kind === 'topic') return 'cs_core';
    return String(item.category || '').toLowerCase().includes('apt') ? 'aptitude' : 'cs_core';
};
```

- [ ] **Step 3: Emit after the grade is saved**

In `POST /:id/review`, directly after `await item.save();` (line 150) add:

```js
        // P6 spine: remembered=1, forgot=0 — low weight (0.75), high frequency.
        await emitSignals(req.user._id, [{
            pillar: pillarForItem(item),
            skill: item.category || item.kind,
            score: remembered ? 1 : 0,
            source: 'review',
            sourceId: item._id,
        }]);
```

- [ ] **Step 4: Verify**

Grade one due item on `/review` (or via curl `POST /api/review/<id>/review` with `{"remembered":true}`), then check `/api/prep-profile`:
Expected: the mapped pillar's `sampleCount` increments.

- [ ] **Step 5: Commit**

```bash
git add server/routes/review.js
git commit -m "feat(spine): P6 — review-queue grades emit signals"
```

---

### Task 9: emit from resume analysis + seed from onboarding

**Files:**
- Modify: `server/routes/resumeAnalysis.js` (require at top; hook after `ResumeAnalysis.create` at line 63-74)
- Modify: `server/routes/auth.js` (require at top; hook in `PUT /onboarding` after the user update at line 154)

- [ ] **Step 1: `resumeAnalysis.js` — require at top:**

```js
const { emit: emitSignals } = require('../agent/services/signals');
```

- [ ] **Step 2: Emit after the analysis is persisted**

Directly after the existing `const analysis = await ResumeAnalysis.create({ ... });` block add:

```js
        // P6 spine: ATS match score is the resume pillar's evidence.
        await emitSignals(req.user._id, [{
            pillar: 'resume',
            skill: 'ats_match',
            score: (Number(result.matchScore) || 0) / 100,
            source: 'resume_analysis',
            sourceId: analysis._id,
        }]);
```

- [ ] **Step 3: `auth.js` — require at top (next to the other requires):**

```js
const { emit: emitSignals, ensureProfile } = require('../agent/services/signals');
```

- [ ] **Step 4: Seed profile + diagnostic signals in `PUT /onboarding`**

Directly after the existing line 154 (`const user = await User.findByIdAndUpdate(...)`) and before the `res.json`, add:

```js
    // P6 spine: seed the prep profile from the diagnostic. Self-reported level
    // baselines the four skill pillars (NOT resume — that needs a real ATS run).
    // Weight is the standard 'diagnostic' 1.5 and decays away within weeks, so
    // real activity quickly dominates the self-report.
    const LEVEL_SCORE = { beginner: 0.35, intermediate: 0.55, advanced: 0.7 };
    const base = LEVEL_SCORE[experienceLevel];
    if (base !== undefined) {
        await emitSignals(req.user._id, ['aptitude', 'dsa', 'cs_core', 'communication'].map((pillar) => ({
            pillar, skill: 'diagnostic', score: base, source: 'diagnostic', sourceId: user._id,
        })));
    }
    if (update.aimingCompany) {
        const profile = await ensureProfile(req.user._id);
        if (!profile.targetCompanies.some((c) => c.name === update.aimingCompany)) {
            profile.targetCompanies.unshift({ name: update.aimingCompany, priority: 1 });
            profile.targetCompanies = profile.targetCompanies.slice(0, 5);
            await profile.save();
        }
    }
```

- [ ] **Step 5: Verify**

1. Resume: run an analysis on `/resume-analysis` (needs `GROQ_API_KEY`; the service has a keyword fallback) → `/api/prep-profile` shows `resume.sampleCount` ≥ 1.
2. Onboarding: `curl -s -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"aimingCompany\":\"TCS\",\"experienceLevel\":\"intermediate\"}" http://localhost:5000/api/auth/onboarding`
   → `/api/prep-profile` shows 4 skill pillars with `sampleCount` ≥ 1 (~55 where no other data) and `TCS` in `targetCompanies`. `resume` pillar untouched by the diagnostic.

- [ ] **Step 6: Commit**

```bash
git add server/routes/resumeAnalysis.js server/routes/auth.js
git commit -m "feat(spine): P6 — resume analysis emits + onboarding seeds the profile"
```

---

### Task 10: end-to-end verification

**Files:** none new — full-loop check.

- [ ] **Step 1: Clean re-run of the verify script**

From `server/`: `$env:MONGODB_URI="mongodb://127.0.0.1:27017/prism"; node seeds/verifyPrepSpine.js`
Expected: `PREP SPINE SIGNALS: ALL CHECKS PASSED` (script is idempotent — it wipes only its own user's signals/profile first).

- [ ] **Step 2: Live loop**

With both servers running (`server/` + `client/` `npm run dev`), as a mentee:
1. Play one Interview Game round → `GET /api/prep-profile` pillar moves.
2. Submit one coding solution → `dsa` moves.
3. Grade one review item → mapped pillar moves.
4. `POST /plan/refresh` → plan reflects the now-weakest pillar; check off an item via `POST /plan/:itemId/done` → `done: true` persists across a re-GET.
5. Stop Mongo briefly mid-session and submit a game round → the round still completes (emit logs `signal_emit_failed`, request succeeds). Restart Mongo after.

- [ ] **Step 3: Final commit (if any fixups were needed)**

```bash
git add -u
git commit -m "feat(spine): P6 — e2e verification fixups"
```

---

## Self-review notes (done at plan-writing time)

- **Spec coverage:** models ✓ (Task 1), signals service + weights + decay + overall formula ✓ (Task 2), daily plan ✓ (Task 3), API ✓ (Task 4), all 6 wiring rows of the spec table ✓ (Tasks 5–9; `gd_solo`/`gd_live`/`mentor_feedback` sources are wired in P9/P10 per the spec's phasing — the enum already includes them).
- **Deliberate deviation from spec:** the onboarding diagnostic seeds **four** pillars, not five — `resume` readiness from a self-reported experience level would be fabricated data; it comes only from a real ATS run (Task 9 step 2 keeps the spec's resume wiring).
- **Type consistency:** `emit(userId, signals[])` signature identical at every call site; `PILLARS` exported once from `SkillSignal.js` and imported everywhere; plan item kinds (`review|practice|session|resume`) match the model enum.
