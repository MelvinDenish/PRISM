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
        enum: ['pending', 'approved', 'in-progress', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },
    mentorFeedback: String,
    menteeFeedback: String,
    ratingGiven: Number,
    createdAt: { type: Date, default: Date.now }
});

// Indexes (plan §3): the GET sessions query filters by mentor/mentee + status, sorts by date.
mentorshipSessionSchema.index({ mentor: 1, status: 1 });
mentorshipSessionSchema.index({ mentee: 1, status: 1 });
mentorshipSessionSchema.index({ scheduledDate: -1 });

module.exports = mongoose.model('MentorshipSession', mentorshipSessionSchema);
