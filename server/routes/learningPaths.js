const express = require('express');
const { protect } = require('../middleware/auth');
const Groq = require('groq-sdk');
const LearningPath = require('../models/LearningPath');
const Resource = require('../models/Resource');
const Topic = require('../models/Topic');
const router = express.Router();

// GET user's learning paths
router.get('/', protect, async (req, res) => {
  try {
    const paths = await LearningPath.find({ user: req.user._id }).populate('topic', 'name').sort({ createdAt: -1 });
    res.json({ success: true, paths });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET specific path
router.get('/:id', protect, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, user: req.user._id }).populate('topic', 'name');
    if (!path) return res.status(404).json({ success: false, message: 'Path not found' });
    res.json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GENERATE learning path with AI
router.post('/generate', protect, async (req, res) => {
  try {
    const { topicId, level = 'beginner', assessmentAnswers } = req.body;

    const topic = await Topic.findById(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    // Get available resources for this topic
    const resources = await Resource.find({ topic: topicId }).sort({ level: 1, createdAt: 1 });

    if (resources.length === 0) {
      return res.status(400).json({ success: false, message: 'No resources available for this topic' });
    }

    let steps = [];
    if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const resourceList = resources.map(r => `ID:${r._id} | ${r.title} | Level:${r.level} | Type:${r.resourceType}`).join('\n');

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `You are a learning path designer. Given a topic, student level, and available resources, create an optimal ordered learning path. Return JSON array: [{ "resourceId": "...", "order": 1, "title": "step title", "description": "why this step matters", "estimatedTime": "30 min" }]. Select 15-25 resources and order them from foundational to advanced. Only return valid JSON array.` },
          { role: 'user', content: `Topic: ${topic.name}\nStudent Level: ${level}\n${assessmentAnswers ? `Assessment: ${JSON.stringify(assessmentAnswers)}` : ''}\n\nAvailable Resources:\n${resourceList}` }
        ],
        max_tokens: 2000,
        temperature: 0.4
      });

      try {
        const raw = completion.choices[0]?.message?.content || '[]';
        const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        steps = parsed.map((s, i) => {
          const resource = resources.find(r => r._id.toString() === s.resourceId);
          return {
            order: s.order || i + 1,
            title: s.title || resource?.title || `Step ${i + 1}`,
            description: s.description || '',
            resource: resource?._id,
            resourceTitle: resource?.title || s.title,
            resourceLink: resource?.link,
            estimatedTime: s.estimatedTime || '30 min'
          };
        });
      } catch {
        // Fallback: order by level
        steps = resources.slice(0, 20).map((r, i) => ({
          order: i + 1, title: r.title, description: `${r.level} level ${r.resourceType}`,
          resource: r._id, resourceTitle: r.title, resourceLink: r.link, estimatedTime: '30 min'
        }));
      }
    } else {
      // No AI: simple ordering by level
      const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
      const sorted = [...resources].sort((a, b) => (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0));
      steps = sorted.slice(0, 20).map((r, i) => ({
        order: i + 1, title: r.title, description: `${r.level} level ${r.resourceType}`,
        resource: r._id, resourceTitle: r.title, resourceLink: r.link, estimatedTime: '30 min'
      }));
    }

    const path = await LearningPath.create({
      user: req.user._id, topic: topicId, title: `${topic.name} Learning Path`,
      description: `Personalized ${level} path for ${topic.name}`,
      level, steps, totalSteps: steps.length, aiGenerated: !!process.env.GROQ_API_KEY
    });

    res.status(201).json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
    path.progress = Math.round((path.completedSteps / path.totalSteps) * 100);
    await path.save();

    res.json({ success: true, path });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE path
router.delete('/:id', protect, async (req, res) => {
  try {
    await LearningPath.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Path deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
