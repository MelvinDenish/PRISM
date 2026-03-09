const mongoose = require('mongoose');

const codingQuestionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    companyTags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    sampleInput: String,
    sampleOutput: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
