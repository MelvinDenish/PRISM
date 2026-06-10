const express = require('express');
const Progress = require('../models/Progress');
const Resource = require('../models/Resource');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/progress - Get current user's progress
router.get('/', protect, async (req, res) => {
    try {
        let progress = await Progress.findOne({ mentee: req.user._id })
            .populate('completedResources', 'title topic')
            .populate('topicProgress.topic', 'name');

        if (!progress) {
            progress = await Progress.create({ mentee: req.user._id });
        }
        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/progress/complete/:resourceId - Mark a resource as complete
router.patch('/complete/:resourceId', protect, async (req, res) => {
    try {
        // Only allow completing a resource that actually exists.
        const resource = await Resource.findById(req.params.resourceId);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        let progress = await Progress.findOne({ mentee: req.user._id });
        if (!progress) {
            progress = await Progress.create({ mentee: req.user._id });
        }

        // Avoid duplicates
        if (!progress.completedResources.some(id => id.toString() === req.params.resourceId)) {
            progress.completedResources.push(req.params.resourceId);
        }

        // Recalculate topic progress
        if (resource.topic) {
            const topicId = resource.topic.toString();
            const totalForTopic = await Resource.countDocuments({ topic: resource.topic });

            const completedResourceDocs = await Resource.find({
                _id: { $in: progress.completedResources },
                topic: resource.topic
            });

            const percentage = totalForTopic > 0 ? Math.round((completedResourceDocs.length / totalForTopic) * 100) : 0;

            const topicIdx = progress.topicProgress.findIndex(
                (tp) => tp.topic && tp.topic.toString() === topicId
            );

            if (topicIdx >= 0) {
                progress.topicProgress[topicIdx].percentage = percentage;
            } else {
                progress.topicProgress.push({ topic: resource.topic, percentage });
            }
        }

        progress.updatedAt = Date.now();
        await progress.save();

        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// PATCH /api/progress/uncomplete/:resourceId - Unmark a resource
router.patch('/uncomplete/:resourceId', protect, async (req, res) => {
    try {
        const progress = await Progress.findOne({ mentee: req.user._id });
        if (!progress) return res.status(404).json({ success: false, message: 'No progress found' });

        progress.completedResources = progress.completedResources.filter(
            (id) => id.toString() !== req.params.resourceId
        );

        // Recalculate topic progress after uncomplete
        const resource = await Resource.findById(req.params.resourceId);
        if (resource && resource.topic) {
            const topicId = resource.topic.toString();
            const totalForTopic = await Resource.countDocuments({ topic: resource.topic });
            const completedResourceDocs = await Resource.find({
                _id: { $in: progress.completedResources },
                topic: resource.topic
            });
            const percentage = totalForTopic > 0 ? Math.round((completedResourceDocs.length / totalForTopic) * 100) : 0;
            const topicIdx = progress.topicProgress.findIndex(
                (tp) => tp.topic && tp.topic.toString() === topicId
            );
            if (topicIdx >= 0) {
                progress.topicProgress[topicIdx].percentage = percentage;
            }
        }

        progress.updatedAt = Date.now();
        await progress.save();

        res.json({ success: true, progress });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/progress/stats - Get progress stats with topic-wise percentages
router.get('/stats', protect, async (req, res) => {
    try {
        const progress = await Progress.findOne({ mentee: req.user._id })
            .populate('topicProgress.topic', 'name');

        if (!progress) {
            return res.json({ success: true, stats: { totalCompleted: 0, topicProgress: [], mockInterviewStats: {} } });
        }

        const totalResources = await Resource.countDocuments();

        res.json({
            success: true,
            stats: {
                totalCompleted: progress.completedResources.length,
                totalResources,
                overallPercentage: totalResources > 0 ? Math.round((progress.completedResources.length / totalResources) * 100) : 0,
                topicProgress: progress.topicProgress,
                mockInterviewStats: progress.mockInterviewStats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
