const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
    order: Number,
    title: String,
    description: String,
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    resourceTitle: String,
    resourceLink: String,
    estimatedTime: String,
    completed: { type: Boolean, default: false },
    completedAt: Date
});

const learningPathSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    title: String,
    description: String,
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    steps: [stepSchema],
    totalSteps: { type: Number, default: 0 },
    completedSteps: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    aiGenerated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LearningPath', learningPathSchema);
