/**
 * Shared learning-path generation service.
 *
 * Extracted from routes/learningPaths.js POST /generate so the HTTP route AND the
 * assistant's `create_learning_path` write tool produce identical roadmaps from one
 * implementation. `buildSteps` does the AI ordering (read-only); `createLearningPath`
 * persists — the latter is the executor the confirm gate calls.
 *
 * Generation uses the assistant's pluggable LLM (LLM_GEN_MODEL), falling back to a
 * deterministic level-ordering when no LLM is configured — same behavior the route
 * had, just unified onto one client.
 */

const llm = require('../llm');
const { config } = require('../../config/env');
const LearningPath = require('../../models/LearningPath');
const Resource = require('../../models/Resource');
const Topic = require('../../models/Topic');

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

function fallbackSteps(resources) {
  const sorted = [...resources].sort((a, b) => (LEVEL_ORDER[a.level] || 0) - (LEVEL_ORDER[b.level] || 0));
  return sorted.slice(0, 20).map((r, i) => ({
    order: i + 1,
    title: r.title,
    description: `${r.level} level ${r.resourceType}`,
    resource: r._id,
    resourceTitle: r.title,
    resourceLink: r.link,
    estimatedTime: '30 min',
  }));
}

/**
 * Build an ordered list of steps for a topic from its available resources.
 * Read-only (no persistence). Throws { statusCode } for caller-facing errors.
 * @returns {Promise<{ topic: object, steps: Array }>}
 */
async function buildSteps({ topicId, level = 'beginner', assessmentAnswers }) {
  const topic = await Topic.findById(topicId);
  if (!topic) { const e = new Error('Topic not found'); e.statusCode = 404; throw e; }

  const resources = await Resource.find({ topic: topicId }).sort({ level: 1, createdAt: 1 });
  if (resources.length === 0) {
    const e = new Error('No resources available for this topic'); e.statusCode = 400; throw e;
  }

  if (!config.hasLLM()) {
    return { topic, steps: fallbackSteps(resources) };
  }

  const resourceList = resources
    .map((r) => `ID:${r._id} | ${r.title} | Level:${r.level} | Type:${r.resourceType}`)
    .join('\n');

  try {
    // Non-PII (topic + public resources): route the fast failover pool so path
    // generation survives a throttled provider (Cerebras → Groq → OpenRouter).
    const message = await llm.chatWithFailover({
      pool: llm.fastPool('gen'),
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a learning path designer. Given a topic, student level, and available resources, create an optimal ordered learning path. Return JSON array: [{ "resourceId": "...", "order": 1, "title": "step title", "description": "why this step matters", "estimatedTime": "30 min" }]. Select 15-25 resources and order them from foundational to advanced. Only return valid JSON array.' },
        { role: 'user', content: `Topic: ${topic.name}\nStudent Level: ${level}\n${assessmentAnswers ? `Assessment: ${JSON.stringify(assessmentAnswers)}` : ''}\n\nAvailable Resources:\n${resourceList}` },
      ],
    });
    const raw = message.content || '[]';
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    const steps = parsed.map((s, i) => {
      const resource = resources.find((r) => r._id.toString() === s.resourceId);
      return {
        order: s.order || i + 1,
        title: s.title || resource?.title || `Step ${i + 1}`,
        description: s.description || '',
        resource: resource?._id,
        resourceTitle: resource?.title || s.title,
        resourceLink: resource?.link,
        estimatedTime: s.estimatedTime || '30 min',
      };
    });
    return { topic, steps: steps.length ? steps : fallbackSteps(resources) };
  } catch {
    return { topic, steps: fallbackSteps(resources) };
  }
}

/**
 * Build + persist a learning path for a user. This is the confirm-gate executor.
 * @returns {Promise<object>} the created LearningPath document
 */
async function createLearningPath({ userId, topicId, level = 'beginner', assessmentAnswers }) {
  const { topic, steps } = await buildSteps({ topicId, level, assessmentAnswers });
  return LearningPath.create({
    user: userId,
    topic: topicId,
    title: `${topic.name} Learning Path`,
    description: `Personalized ${level} path for ${topic.name}`,
    level,
    steps,
    totalSteps: steps.length,
    aiGenerated: config.hasLLM(),
  });
}

/** Resolve a topic by id or (case-insensitive) name; returns the doc or null. */
async function resolveTopic({ topicId, topicName }) {
  if (topicId) {
    const byId = await Topic.findById(topicId).catch(() => null);
    if (byId) return byId;
  }
  if (topicName) {
    const esc = String(topicName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Topic.findOne({ name: new RegExp(esc, 'i') });
  }
  return null;
}

module.exports = { buildSteps, createLearningPath, resolveTopic };
