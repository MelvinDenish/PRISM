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
const { generateDocument } = require('../agent/services/document');
const Conversation = require('../models/Conversation');
const Artifact = require('../models/Artifact');
const User = require('../models/User');
const { paletteFromHue } = require('../utils/themeGenerator');

// Validation constants for generate_document executor
const ALLOWED_FORMATS = ['pdf', 'docx', 'md'];
const ALLOWED_KINDS   = ['resume', 'cover_letter', 'document'];
const MAX_TITLE_LEN   = 200;
const MAX_CONTENT_LEN = 102400; // 100KB

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

  generate_document: async (params, ctx) => {
    // Server-side re-validation (params arrive from an untrusted POST body).
    const { title, format, kind, content, conversationId } = params;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      const e = new Error('title is required'); e.statusCode = 400; throw e;
    }
    if (!ALLOWED_FORMATS.includes(format)) {
      const e = new Error(`format must be one of: ${ALLOWED_FORMATS.join(', ')}`); e.statusCode = 400; throw e;
    }
    if (kind && !ALLOWED_KINDS.includes(kind)) {
      const e = new Error(`kind must be one of: ${ALLOWED_KINDS.join(', ')}`); e.statusCode = 400; throw e;
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      const e = new Error('content is required'); e.statusCode = 400; throw e;
    }
    if (title.length > MAX_TITLE_LEN) {
      const e = new Error(`title must be under ${MAX_TITLE_LEN} characters`); e.statusCode = 400; throw e;
    }
    if (content.length > MAX_CONTENT_LEN) {
      const e = new Error('content exceeds the 100KB limit'); e.statusCode = 400; throw e;
    }

    // Per-user cap: at most 30 documents in any rolling 24h window. Prevents a
    // single account from exhausting disk/storage budget via the assistant.
    const last24h = await Artifact.countDocuments({
      user: ctx.userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (last24h >= 30) {
      const e = new Error('Daily document limit reached (30). Try again tomorrow.');
      e.statusCode = 429;
      throw e;
    }

    const result = await generateDocument({
      userId: ctx.userId,
      conversationId: conversationId || undefined,
      kind: kind || 'document',
      title: title.trim(),
      format,
      content,
    });

    return { kind: 'artifact', id: result.id, title: result.title, format: result.format, url: result.url };
  },

  apply_theme: async (params, ctx) => {
    // The proposal's colors arrive from an untrusted POST body. Re-derive the
    // whole palette server-side from the numeric hue so no client-supplied CSS
    // string is ever persisted/applied.
    const hue = Number(params.theme?.hue);
    if (!Number.isFinite(hue) || hue < 0 || hue >= 360) {
      const e = new Error('Invalid theme — no valid hue to apply.'); e.statusCode = 400; throw e;
    }
    const theme = paletteFromHue(hue);
    await User.findByIdAndUpdate(ctx.userId, { theme });
    return { kind: 'theme', applied: true, theme };
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
      // Cap existing conversations at 200 messages to prevent unbounded growth.
      if (doc.messages.length >= 200) {
        return res.status(400).json({
          success: false,
          message: 'This conversation is full — start a new chat.',
        });
      }
    } else {
      // Create a new conversation doc (no messages yet; both turns will be $push-ed atomically).
      doc = await Conversation.create({ user: userId, title: autoTitle(message), messages: [] });
    }

    // Build the messages array for the agent (existing history + new user turn).
    const userTurn = {
      role: 'user',
      content: message.trim(),
    };
    const agentMessages = [
      ...doc.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: userTurn.role, content: userTurn.content },
    ];

    // Run the agent. If it throws on a freshly created conversation, remove the
    // empty doc so a failed first message doesn't orphan a blank chat in the rail.
    let result;
    try {
      result = await runAgent({ messages: agentMessages, userId, role: req.user.role });
    } catch (agentErr) {
      if (!conversationId) {
        await Conversation.deleteOne({ _id: doc._id, user: userId }).catch(() => {});
      }
      throw agentErr;
    }

    // Build the assistant turn with metadata.
    const assistantTurn = {
      role: 'assistant',
      content: result.reply || '',
      proposedActions: result.proposedActions || [],
      toolsUsed: result.toolsUsed || [],
      artifacts: [],
    };

    // Atomically persist both turns (timestamps.updatedAt is updated automatically by Mongoose).
    await Conversation.findOneAndUpdate(
      { _id: doc._id, user: userId },
      { $push: { messages: { $each: [userTurn, assistantTurn] } } },
      { new: true }
    );

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
