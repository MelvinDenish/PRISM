const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    type: { type: String, enum: ['session', 'mock', 'resource', 'general'] },
    isRead: { type: Boolean, default: false },
    link: String,
    createdAt: { type: Date, default: Date.now }
});

// Indexes (plan §3): list by user newest-first, and count unread.
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
// TTL: auto-purge notifications after 90 days to keep the collection lean.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
