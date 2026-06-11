const mongoose = require('mongoose');

const pillarStateSchema = new mongoose.Schema({
    score: { type: Number, default: 0 },           // 0–100
    trend: { type: String, enum: ['up', 'flat', 'down'], default: 'flat' },
    sampleCount: { type: Number, default: 0 },
    updatedAt: Date,
}, { _id: false });

const planItemSchema = new mongoose.Schema({
    kind: { type: String, enum: ['review', 'practice', 'session', 'resume'], required: true },
    title: { type: String, required: true },
    link: { type: String, required: true },        // client route, e.g. '/review'
    reason: { type: String, default: '' },
    done: { type: Boolean, default: false },
});

// One per mentee. Created lazily by services/signals.ensureProfile() — there is
// no migration; existing users get a profile on first read.
const prepProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    targetRole: { type: String, default: '' },
    targetCompanies: [{
        company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
        name: { type: String, required: true },
        priority: { type: Number, default: 1, min: 1, max: 3 },
    }],
    timeline: { firstInterviewAt: Date },
    // Derived cache — recomputed by services/signals on every emit. The SkillSignal
    // collection is the source of truth; never hand-edit these numbers.
    readiness: {
        overall: { type: Number, default: 0 },
        pillars: {
            aptitude: { type: pillarStateSchema, default: () => ({}) },
            dsa: { type: pillarStateSchema, default: () => ({}) },
            cs_core: { type: pillarStateSchema, default: () => ({}) },
            communication: { type: pillarStateSchema, default: () => ({}) },
            resume: { type: pillarStateSchema, default: () => ({}) },
        },
    },
    dailyPlan: {
        date: Date,
        items: [planItemSchema],
        generatedAt: Date,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PrepProfile', prepProfileSchema);
