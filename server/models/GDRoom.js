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
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GDRoom', gdRoomSchema);
