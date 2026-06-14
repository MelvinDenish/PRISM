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

// Phase 2: the path's final test. `questions` is the CLIENT-SAFE payload (no
// answers); `servedKey` is the SERVER-ONLY answer key (correct MCQ answers /
// coding test cases) — it must NEVER be serialized to the client (see
// sanitizePath in routes/learningPaths.js, mirroring sanitizeGame).
const finalTestSchema = new mongoose.Schema({
    generated: { type: Boolean, default: false },
    format: { type: String, enum: ['mcq', 'coding', 'mixed'], default: 'mcq' },
    questions: { type: Array, default: [] },     // client-safe (MCQ: q/opts; coding: title/desc/examples/boilerplate)
    servedKey: { type: Array, default: [] },      // SERVER-ONLY: [{ id, ans }] for MCQ or [{ id, testCases }] for coding
    generatedAt: Date,
}, { _id: false });

const attemptSchema = new mongoose.Schema({
    score: Number,
    passed: Boolean,
    answers: Array,
    takenAt: { type: Date, default: Date.now },
}, { _id: false });

const certificateSchema = new mongoose.Schema({
    issued: { type: Boolean, default: false },
    certId: String,
    issuedAt: Date,
}, { _id: false });

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
    // Phase 2: final test, attempts, pass state + certificate. Completion of the
    // PATH is `passed === true` (steps still track the reading journey).
    finalTest: { type: finalTestSchema, default: undefined },
    attempts: { type: [attemptSchema], default: [] },
    bestScore: { type: Number, default: 0 },
    passThreshold: { type: Number, default: 90 },
    passed: { type: Boolean, default: false },
    passedAt: Date,
    certificate: { type: certificateSchema, default: undefined },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LearningPath', learningPathSchema);
