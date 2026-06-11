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
    await profile.save();
    return profile;
}

module.exports = { buildDailyPlan, refreshDailyPlan, MAX_ITEMS };
