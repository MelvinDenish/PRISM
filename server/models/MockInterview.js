const mongoose = require('mongoose');

const mockInterviewSchema = new mongoose.Schema({
    type: { type: String, enum: ['technical', 'hr', 'gd'], required: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    companyFocus: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    scheduledDate: Date,
    duration: Number,
    meetingLink: String,
    status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
    createdAt: { type: Date, default: Date.now }
});

// Indexes (plan §3): listed/filtered by status and mentor, sorted by date.
mockInterviewSchema.index({ status: 1, scheduledDate: -1 });
mockInterviewSchema.index({ mentor: 1 });

module.exports = mongoose.model('MockInterview', mockInterviewSchema);
