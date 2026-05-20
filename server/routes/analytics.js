const express = require('express');
const Progress = require('../models/Progress');
const InterviewGame = require('../models/InterviewGame');
const Resource = require('../models/Resource');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/analytics/dashboard
router.get('/dashboard', protect, async (req, res) => {
    try {
        const progress = await Progress.findOne({ mentee: req.user._id })
            .populate('topicProgress.topic', 'name');

        const totalResources = await Resource.countDocuments();

        // ── Compute real scores from InterviewGame rounds ──
        const completedGames = await InterviewGame.find({
            user: req.user._id,
            status: 'completed'
        }).sort({ completedAt: -1 }).limit(20);

        // Aggregate scores by round type across all completed games
        const roundScores = { aptitude: [], technical: [], coding: [], gd: [], hr: [] };
        completedGames.forEach(game => {
            game.rounds.forEach(r => {
                if (r.status !== 'completed') return;
                const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
                if (r.type === 'aptitude') roundScores.aptitude.push(pct);
                else if (r.type === 'technical1' || r.type === 'technical2') roundScores.technical.push(pct);
                else if (r.type === 'coding') roundScores.coding.push(pct);
                else if (r.type === 'gd') roundScores.gd.push(pct);
                else if (r.type === 'hr') roundScores.hr.push(pct);
            });
        });

        const avg = arr => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

        const averageScores = {
            technical: avg([...roundScores.technical, ...roundScores.coding]),
            communication: avg([...roundScores.gd, ...roundScores.hr]),
            confidence: avg(roundScores.hr),
            problemSolving: avg([...roundScores.aptitude, ...roundScores.coding]),
        };

        // Weakness detection from actual game performance
        const weakAreas = [];
        if (progress && progress.topicProgress.length > 0) {
            const maxProgress = Math.max(...progress.topicProgress.map(t => t.percentage));
            progress.topicProgress.forEach(tp => {
                if (tp.percentage < maxProgress - 20 && tp.topic) {
                    weakAreas.push({
                        topic: tp.topic.name,
                        percentage: tp.percentage,
                        gap: maxProgress - tp.percentage
                    });
                }
            });
        }

        // Score-based weakness detection from real game data
        const scoreAreas = [];
        const maxScore = Math.max(averageScores.technical, averageScores.communication, averageScores.confidence, averageScores.problemSolving);
        if (maxScore > 0) {
            if (averageScores.technical < maxScore - 15) scoreAreas.push({ area: 'Technical', score: averageScores.technical });
            if (averageScores.communication < maxScore - 15) scoreAreas.push({ area: 'Communication', score: averageScores.communication });
            if (averageScores.confidence < maxScore - 15) scoreAreas.push({ area: 'Confidence', score: averageScores.confidence });
            if (averageScores.problemSolving < maxScore - 15) scoreAreas.push({ area: 'Problem Solving', score: averageScores.problemSolving });
        }

        // Best/recent game stats
        const bestGame = completedGames.reduce((best, g) => {
            const pct = g.maxTotalScore > 0 ? (g.totalScore / g.maxTotalScore) * 100 : 0;
            return pct > (best?.pct || 0) ? { pct, score: g.totalScore, max: g.maxTotalScore } : best;
        }, null);

        res.json({
            success: true,
            dashboard: {
                resourcesCompleted: progress ? progress.completedResources.length : 0,
                totalResources,
                overallProgress: totalResources > 0 && progress
                    ? Math.round((progress.completedResources.length / totalResources) * 100) : 0,
                topicProgress: progress ? progress.topicProgress : [],
                averageScores,
                totalGamesPlayed: completedGames.length,
                bestGameScore: bestGame ? Math.round(bestGame.pct) : 0,
                weakAreas,
                scoreWeaknesses: scoreAreas,
                roundAverages: {
                    aptitude: avg(roundScores.aptitude),
                    technical: avg(roundScores.technical),
                    coding: avg(roundScores.coding),
                    gd: avg(roundScores.gd),
                    hr: avg(roundScores.hr)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
