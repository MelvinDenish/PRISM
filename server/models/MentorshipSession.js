const mongoose = require('mongoose');

const mentorshipSessionSchema = new mongoose.Schema({
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mentee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    aimingCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    agenda: String,
    scheduledDate: { type: Date, required: true },
    duration: Number,
    meetingLink: String,
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },
    mentorFeedback: String,
    menteeFeedback: String,
    ratingGiven: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MentorshipSession', mentorshipSessionSchema);
