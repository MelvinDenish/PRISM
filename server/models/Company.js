const mongoose = require('mongoose');

// CUIC placement eligibility criteria (Phase 1). Every field is optional — an
// unset field is simply not enforced, so a company with no criteria is open to
// all. Compared against a User's academics by utils/eligibility.checkEligibility.
const eligibilitySchema = new mongoose.Schema({
    cgpaCutoff: Number,            // minimum CGPA, e.g. 7.0
    maxActiveArrears: Number,      // allowed current arrears, e.g. 0
    maxHistoryArrears: Number,     // allowed history of arrears, e.g. 2
    tenthMin: Number,              // minimum 10th %, e.g. 60
    twelfthMin: Number,            // minimum 12th %, e.g. 60
    eligibleBranches: [String],    // e.g. ['CSE','IT','ECE']; empty = all branches
    batch: String,                 // restrict to a graduation batch, e.g. '2026'
}, { _id: false });

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    interviewPattern: String,
    difficultyLevel: String,
    eligibility: { type: eligibilitySchema, default: undefined },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
