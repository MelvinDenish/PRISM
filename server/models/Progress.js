const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
    mentee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    mockInterviewStats: {
        technicalScoreAvg: { type: Number, default: 0 },
        hrScoreAvg: { type: Number, default: 0 },
        gdScoreAvg: { type: Number, default: 0 }
    },
    topicProgress: [{
        topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
        percentage: { type: Number, default: 0 }
    }],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Progress', progressSchema);
