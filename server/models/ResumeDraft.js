const mongoose = require('mongoose');

// P7 resume canvas: a point-in-time snapshot of the editable sections, captured
// before every AI edit (refine/tailor) so a one-click restore is always possible.
// `snapshot` mirrors the shapeDraft() output (the five diffable sections).
const revisionSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now },
    label: { type: String, default: '' },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: true });

const resumeDraftSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'Untitled Resume' },
    template: { type: String, enum: ['modern', 'classic', 'creative'], default: 'modern' },
    // ── Generative Resume Studio ──
    // AI-generated visual design spec. `template` is kept for backward-compat;
    // legacy drafts (no `design`) are mapped at read-time by legacyTemplateToDesign().
    design: {
        layout: { type: String, default: 'single-column' },
        palette: {
            primary: String, accent: String, text: String,
            muted: String, bg: String, surface: String,
        },
        fonts: { heading: String, body: String },
        density: { type: String, enum: ['compact', 'normal', 'roomy'], default: 'normal' },
        headingStyle: { type: String, enum: ['underline', 'bar', 'caps', 'plain'], default: 'underline' },
        sectionOrder: { type: [String], default: undefined },
        hidden: { type: [String], default: [] },
    },
    personalInfo: {
        fullName: String, email: String, phone: String, location: String,
        linkedin: String, github: String, portfolio: String, summary: String
    },
    education: [{ institution: String, degree: String, field: String, startDate: String, endDate: String, gpa: String }],
    experience: [{ company: String, position: String, startDate: String, endDate: String, current: Boolean, description: String }],
    skills: [String],
    projects: [{ name: String, description: String, technologies: String, link: String }],
    certifications: [{ name: String, issuer: String, date: String }],
    coverLetter: { template: { type: String, enum: ['professional', 'creative'], default: 'professional' }, content: String, jobTitle: String, companyName: String },
    jobDescription: String,
    lastGenerated: Date,
    // ── P7 resume canvas ──
    // A JD-tailored variant points back to the draft it was forked from.
    parentDraft: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeDraft', default: null },
    targetCompany: { type: String, default: '' },
    targetRole: { type: String, default: '' },
    // Skills the JD asks for that are NOT in the resume. Rendered as suggestions —
    // NEVER inserted into the resume (the hallucination guard). Refreshed on tailor.
    gaps: [{ type: String }],
    // On-demand ATS score cache (keyword/Gemini analysis of this draft vs its JD).
    atsScore: { type: Number, default: null },
    atsCheckedAt: { type: Date, default: null },
    revisions: { type: [revisionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

resumeDraftSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('ResumeDraft', resumeDraftSchema);
