const express = require('express');
const Progress = require('../models/Progress');
const MockFeedback = require('../models/MockFeedback');
const Resource = require('../models/Resource');
const CodeSubmission = require('../models/CodeSubmission');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/analytics/dashboard
router.get('/dashboard', protect, async (req, res) => {
    try {
        const progress = await Progress.findOne({ mentee: req.user._id })
            .populate('topicProgress.topic', 'name');

        const feedbacks = await MockFeedback.find({ user: req.user._id });
        const submissions = await CodeSubmission.find({ user: req.user._id });
        const totalResources = await Resource.countDocuments();

        // Calculate averages
        const avgScores = { technical: 0, communication: 0, confidence: 0, problemSolving: 0, overall: 0 };
        if (feedbacks.length > 0) {
            feedbacks.forEach((f) => {
                avgScores.technical += f.technicalScore || 0;
                avgScores.communication += f.communicationScore || 0;
                avgScores.confidence += f.confidenceScore || 0;
                avgScores.problemSolving += f.problemSolvingScore || 0;
                avgScores.overall += f.overallScore || 0;
            });
            Object.keys(avgScores).forEach((k) => {
                avgScores[k] = Math.round(avgScores[k] / feedbacks.length);
            });
        }

        // Weakness detection
        const weakAreas = [];
        if (progress && progress.topicProgress.length > 0) {
            const maxProgress = Math.max(...progress.topicProgress.map((t) => t.percentage));
            progress.topicProgress.forEach((tp) => {
                if (tp.percentage < maxProgress - 20 && tp.topic) {
                    weakAreas.push({
                        topic: tp.topic.name,
                        percentage: tp.percentage,
                        gap: maxProgress - tp.percentage
                    });
                }
            });
        }

        // Score-based weakness detection
        const scoreAreas = [];
        if (avgScores.technical > 0) {
            const maxScore = Math.max(avgScores.technical, avgScores.communication, avgScores.confidence, avgScores.problemSolving);
            if (avgScores.technical < maxScore - 20) scoreAreas.push({ area: 'Technical', score: avgScores.technical });
            if (avgScores.communication < maxScore - 20) scoreAreas.push({ area: 'Communication', score: avgScores.communication });
            if (avgScores.confidence < maxScore - 20) scoreAreas.push({ area: 'Confidence', score: avgScores.confidence });
            if (avgScores.problemSolving < maxScore - 20) scoreAreas.push({ area: 'Problem Solving', score: avgScores.problemSolving });
        }

        res.json({
            success: true,
            dashboard: {
                resourcesCompleted: progress ? progress.completedResources.length : 0,
                totalResources,
                overallProgress: totalResources > 0 && progress
                    ? Math.round((progress.completedResources.length / totalResources) * 100) : 0,
                topicProgress: progress ? progress.topicProgress : [],
                mockInterviewStats: progress ? progress.mockInterviewStats : {},
                averageScores: avgScores,
                totalMockInterviews: feedbacks.length,
                totalSubmissions: submissions.length,
                weakAreas,
                scoreWeaknesses: scoreAreas,
                recentFeedbacks: feedbacks.slice(-5)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
