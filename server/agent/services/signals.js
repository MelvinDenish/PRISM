// Signal spine core: emit() appends evidence and recomputes readiness onto the
// user's PrepProfile. Deterministic — no LLM. Shared by HTTP routes and agent
// tools (same pattern as the other services in this directory).
const SkillSignal = require('../../models/SkillSignal');
const { PILLARS, SOURCES } = SkillSignal;
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

    // Trend: plain (undecayed) mean of the last 7 days vs all older signals in
    // the horizon. Coarse by design — it's an informational arrow, not a metric.
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
            .filter((s) => s
                && PILLARS.includes(s.pillar)
                && Number.isFinite(Number(s.score))
                && SOURCES.includes(s.source))
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
        await ensureProfile(userId);
        const touched = [...new Set(docs.map((d) => d.pillar))];
        const update = { updatedAt: new Date() };
        for (const pillar of touched) {
            update[`readiness.pillars.${pillar}`] = await computePillar(userId, pillar);
        }
        const profile = await PrepProfile.findOne({ user: userId }).lean();
        const merged = { ...profile.readiness.pillars };
        for (const pillar of touched) merged[pillar] = update[`readiness.pillars.${pillar}`];
        update['readiness.overall'] = overallFrom(merged);
        return await PrepProfile.findOneAndUpdate({ user: userId }, { $set: update }, { new: true });
    } catch (err) {
        logger.warn('signal_emit_failed', { userId: String(userId), err: err.message });
        return null;
    }
}

// Full recompute of all five pillars (used by GET /prep-profile so a stale
// cache self-heals, and by the verify script).
async function readiness(userId) {
    await ensureProfile(userId);
    const update = { updatedAt: new Date() };
    const states = {};
    for (const pillar of PILLARS) {
        states[pillar] = await computePillar(userId, pillar);
        update[`readiness.pillars.${pillar}`] = states[pillar];
    }
    update['readiness.overall'] = overallFrom(states);
    return PrepProfile.findOneAndUpdate({ user: userId }, { $set: update }, { new: true });
}

module.exports = { emit, readiness, ensureProfile, SOURCE_WEIGHTS, HALF_LIFE_DAYS, HORIZON_DAYS };
