const mongoose = require('mongoose');

const resumeDraftSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'Untitled Resume' },
    template: { type: String, enum: ['modern', 'classic', 'creative'], default: 'modern' },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

resumeDraftSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('ResumeDraft', resumeDraftSchema);
