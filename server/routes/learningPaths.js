const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const LearningPath = require('../models/LearningPath');
const { createLearningPath } = require('../agent/services/learningPath');
const router = express.Router();

// GET user's learning paths
router.get('/', protect, async (req, res) => {
  try {
    const paths = await LearningPath.find({ user: req.user._id }).populate('topic', 'name').sort({ createdAt: -1 });
    res.json({ success: true, paths });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET specific path
router.get('/:id', protect, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });
    res.json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GENERATE learning path with AI. The generation/persistence logic lives in the
// shared service (server/agent/services/learningPath.js) so the assistant's
// create_learning_path tool produces identical roadmaps.
router.post('/generate', protect, aiLimiter, async (req, res) => {
  try {
    const { topicId, level = 'beginner', assessmentAnswers } = req.body;
    const path = await createLearningPath({ userId: req.user._id, topicId, level, assessmentAnswers });
    res.status(201).json({ success: true, path });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message),
    });
  }
});

// UPDATE step progress
router.patch('/:id/progress', protect, async (req, res) => {
  try {
    const { stepIndex, completed } = req.body;
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id });
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });

    if (path.steps[stepIndex]) {
      path.steps[stepIndex].completed = completed;
      if (completed) path.steps[stepIndex].completedAt = new Date();
    }

    path.completedSteps = path.steps.filter(s => s.completed).length;
    const denom = path.totalSteps || path.steps.length || 0;
    path.progress = denom > 0 ? Math.round((path.completedSteps / denom) * 100) : 0;
    await path.save();

    res.json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// DELETE path
router.delete('/:id', protect, async (req, res) => {
  try {
    await LearningPath.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Path deleted' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
