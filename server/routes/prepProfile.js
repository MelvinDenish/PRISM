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
// dailyPlan is NOT auto-refreshed here: clients should POST /plan/refresh when
// dailyPlan.generatedAt is older than a day.
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
