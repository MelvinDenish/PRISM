const mongoose = require('mongoose');

const gdRoomSchema = new mongoose.Schema({
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxParticipants: { type: Number, default: 6 },
    status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
    gdTopic: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GDRoom', gdRoomSchema);
