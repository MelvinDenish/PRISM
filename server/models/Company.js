const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    interviewPattern: String,
    difficultyLevel: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
