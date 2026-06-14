const mongoose = require('mongoose');

const gdRoomSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxParticipants: { type: Number, default: 6 },
    status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
    gdTopic: String,
    // Video topology for live video tokens (server/routes/rtc.js):
    //   'group'   → every participant publishes (n-n group discussion)
    //   'webinar' → only `host` publishes; everyone else is subscribe-only (1-to-many)
    mode: { type: String, enum: ['group', 'webinar'], default: 'group' },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // room creator; the publisher in webinar mode
    // Privacy: rooms are NO LONGER discoverable by listing — you join with the code
    // (or, for webinars, you must also be on `invitedUsers`). Generated on create.
    inviteCode: { type: String, index: true },
    // Allowlist for webinar mode: only these mentees (+ host/admin) may join & watch.
    // For 'group' friend rooms the code alone gates access, so this stays empty.
    invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startedAt: { type: Date }, // set by POST /api/gd-rooms/:id/start
    endedAt: { type: Date },   // set when the room/webinar is ended
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GDRoom', gdRoomSchema);
