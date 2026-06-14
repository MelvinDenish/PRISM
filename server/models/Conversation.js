/**
 * Conversation — persists PRISM Copilot chat histories per user.
 *
 * Each document is one conversation thread. `messages` stores all turns in order.
 * Per-message fields:
 *   role            'user' | 'assistant'
 *   content         the text visible in the UI
 *   proposedActions write-action proposals emitted by the agent (Mixed array so
 *                   any proposal shape survives schema evolution)
 *   toolsUsed       names of tools the agent invoked during this turn
 *   artifacts       placeholder for Phase-2 file/doc artifacts (id, name, url …)
 *   createdAt       auto-set at push time
 *
 * The `user` field is indexed so list queries are cheap even with many conversations.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role:            { type: String, enum: ['user', 'assistant'], required: true },
    content:         { type: String, default: '' },
    proposedActions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    toolsUsed:       { type: [String], default: [] },
    artifacts:       { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: true, timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const conversationSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:    { type: String, default: 'New conversation' },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
