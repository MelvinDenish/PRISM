/**
 * Agentic assistant ("PRISM Copilot") API.
 *
 *  POST /api/assistant/chat           — run the tool-calling agent for one user turn.
 *                                       Accepts { conversationId?, message } (persistent)
 *                                       OR legacy { messages } (stateless back-compat).
 *  POST /api/assistant/confirm        — execute a previously PROPOSED write action
 *                                       (the confirm gate).  Accepts { proposedAction,
 *                                       conversationId? } — when conversationId is
 *                                       provided the executor result is persisted onto
 *                                       the last assistant message's artifacts array.
 *  GET  /api/assistant/conversations  — list the caller's conversations (id/title/updatedAt).
 *  GET  /api/assistant/conversations/:id — full conversation including messages.
 *  DELETE /api/assistant/conversations/:id — delete a conversation (owner only).
 *
 * All routes are JWT-protected.  The assistant degrades gracefully (503) when no
 * LLM is configured rather than crashing the request.
 */

const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { config } = require('../config/env');
const { runAgent } = require('../agent/runAgent');
const { createLearningPath } = require('../agent/services/learningPath');
const { bookSession } = require('../agent/services/mentorship');
const { rewriteResume } = require('../agent/services/resume');
const Conversation = require('../models/Conversation');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Auto-generate a title from the first user message (≤ 60 chars, with ellipsis).
 */
function autoTitle(message) {
  const trimmed = message.trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 60)}…`;
}

/**
 * Return 404 (not a 500) for an invalid or unrecognised ObjectId.
 */
function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// ---------------------------------------------------------------------------
// Confirm-gate executors (keyed by proposed-action `type`).
// Signature: async (params, ctx) => result. ctx = { userId, role, name }.
// ---------------------------------------------------------------------------
const EXECUTORS = {
  create_learning_path: async (params, ctx) => {
    if (!['mentee', 'mentor'].includes(ctx.role)) {
      const e = new Error('Not allowed'); e.statusCode = 403; throw e;
    }
    const path = await createLearningPath({
      userId: ctx.userId,
      topicId: params.topicId,
      level: params.level || 'beginner',
    });
    return { kind: 'learning_path', id: String(path._id), title: path.title, totalSteps: path.totalSteps, link: '/learning-paths' };
  },

  book_mentorship_session: async (params, ctx) => {
    if (ctx.role !== 'mentee') {
      const e = new Error('Only mentees can book mentorship sessions'); e.statusCode = 403; throw e;
    }
    const { session, emailed } = await bookSession({
      menteeId: ctx.userId,
      menteeName: ctx.name,
      mentorId: params.mentorId,
      scheduledDate: params.scheduledDate,
      duration: params.durationMinutes || 60,
      agenda: params.agenda,
      awaitEmail: true,
    });
    return {
      kind: 'mentorship_session',
      id: String(session._id),
      status: session.status,
      mentorEmailed: emailed,
      link: '/sessions',
    };
  },

  rewrite_resume: async (params, ctx) => {
    if (ctx.role !== 'mentee') {
      const e = new Error('Only mentees can use the resume rewriter'); e.statusCode = 403; throw e;
    }
    const draft = await rewriteResume({
      userId: ctx.userId,
      resumeText: params.resumeText,
      jobDescription: params.jobDescription,
    });
    return { kind: 'resume_rewrite', id: String(draft._id), name: draft.name, link: '/resume-builder' };
  },
};

// ---------------------------------------------------------------------------
// POST /chat
// ---------------------------------------------------------------------------
router.post('/chat', protect, aiLimiter, async (req, res) => {
  if (!config.hasLLM()) {
    return res.status(503).json({ success: false, message: 'The assistant is not configured on this server.' });
  }

  try {
    const { conversationId, message, messages: legacyMessages } = req.body;
    const userId = req.user._id.toString();

    // ------------------------------------------------------------------
    // LEGACY path: caller sent { messages: [...] } with no conversationId.
    // Stateless — no persistence, identical to the original behaviour.
    // ------------------------------------------------------------------
    if (!message && Array.isArray(legacyMessages)) {
      if (legacyMessages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages must be a non-empty array' });
      }
      const result = await runAgent({ messages: legacyMessages, userId, role: req.user.role });
      return res.json({ success: true, ...result });
    }

    // ------------------------------------------------------------------
    // PERSISTENT path: caller sent { message, conversationId? }.
    // ------------------------------------------------------------------
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message must be a non-empty string' });
    }

    // Load or create conversation.
    let doc;
    if (conversationId) {
      if (!isValidId(conversationId)) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      doc = await Conversation.findOne({ _id: conversationId, user: userId });
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
    } else {
      doc = new Conversation({ user: userId, title: autoTitle(message), messages: [] });
    }

    // Append user turn to the DB document.
    doc.messages.push({ role: 'user', content: message.trim() });

    // Build the messages array for the agent (role + content pairs only).
    const agentMessages = doc.messages.map((m) => ({ role: m.role, content: m.content }));

    // Run the agent.
    const result = await runAgent({ messages: agentMessages, userId, role: req.user.role });

    // Append assistant turn WITH metadata.
    doc.messages.push({
      role: 'assistant',
      content: result.reply || '',
      proposedActions: result.proposedActions || [],
      toolsUsed: result.toolsUsed || [],
      artifacts: [],
    });

    // Mark messages as modified (Mixed sub-doc) and persist.
    doc.markModified('messages');
    await doc.save();

    return res.json({
      success: true,
      conversationId: String(doc._id),
      reply: result.reply || '',
      proposedActions: result.proposedActions || [],
      toolsUsed: result.toolsUsed || [],
    });
  } catch (error) {
    console.error('Assistant chat error:', error);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Assistant error' : error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /confirm
// ---------------------------------------------------------------------------
router.post('/confirm', protect, aiLimiter, async (req, res) => {
  try {
    const { proposedAction, conversationId } = req.body;
    if (!proposedAction || !proposedAction.type) {
      return res.status(400).json({ success: false, message: 'proposedAction with a type is required' });
    }
    const executor = EXECUTORS[proposedAction.type];
    if (!executor) {
      return res.status(400).json({ success: false, message: `Unknown or unsupported action: ${proposedAction.type}` });
    }

    const userId = req.user._id.toString();
    const result = await executor(proposedAction.params || {}, {
      userId,
      role: req.user.role,
      name: req.user.name,
    });

    // Persist executor result onto the last assistant message's artifacts array
    // when a conversationId is provided (minimal / defensive).
    if (conversationId && isValidId(conversationId)) {
      try {
        const doc = await Conversation.findOne({ _id: conversationId, user: userId });
        if (doc && doc.messages.length > 0) {
          // Find the last assistant message.
          let lastIdx = -1;
          for (let i = doc.messages.length - 1; i >= 0; i--) {
            if (doc.messages[i].role === 'assistant') { lastIdx = i; break; }
          }
          if (lastIdx >= 0) {
            const existing = doc.messages[lastIdx].artifacts || [];
            doc.messages[lastIdx].artifacts = [...existing, result];
            doc.markModified('messages');
            await doc.save();
          }
        }
      } catch (persistErr) {
        // Non-fatal — the action already succeeded; just log.
        console.warn('Could not persist artifact onto conversation:', persistErr.message);
      }
    }

    return res.json({ success: true, result });
  } catch (error) {
    console.error('Assistant confirm error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Action failed' : error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /conversations  — list (id / title / updatedAt), newest first
// ---------------------------------------------------------------------------
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const conversations = await Conversation.find({ user: userId })
      .sort({ updatedAt: -1 })
      .select('title updatedAt')
      .lean();
    return res.json({ success: true, conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return res.status(500).json({ success: false, message: 'Could not list conversations' });
  }
});

// ---------------------------------------------------------------------------
// GET /conversations/:id  — full document (ownership enforced)
// ---------------------------------------------------------------------------
router.get('/conversations/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    const userId = req.user._id.toString();
    const doc = await Conversation.findOne({ _id: id, user: userId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    return res.json({ success: true, conversation: doc });
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({ success: false, message: 'Could not retrieve conversation' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /conversations/:id  — delete (ownership enforced)
// ---------------------------------------------------------------------------
router.delete('/conversations/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    const userId = req.user._id.toString();
    const doc = await Conversation.findOneAndDelete({ _id: id, user: userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    return res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ success: false, message: 'Could not delete conversation' });
  }
});

module.exports = router;
