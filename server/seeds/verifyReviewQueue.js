// Throwaway C3 verification helper: seeds a failed coding submission for a real
// mentee and prints a short-lived JWT so the live /api/review endpoints can be
// driven end-to-end. Run with the local DB:
//   MONGODB_URI="mongodb://localhost:27017/prism" node seeds/verifyReviewQueue.js
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CodingQuestion = require('../models/CodingQuestion');
const CodeSubmission = require('../models/CodeSubmission');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ role: 'mentee' });
    if (!user) throw new Error('no mentee user found — run seedAll first');
    const q = await CodingQuestion.findOne({ verified: true });
    if (!q) throw new Error('no coding question found');

    // Simulate the user failing this problem (and make sure they have no accepted
    // submission for it, so it counts as "unsolved").
    await CodeSubmission.deleteMany({ user: user._id, question: q._id });
    await CodeSubmission.create({
        user: user._id, question: q._id, code: 'print(1)', language: 'python',
        passed: false, passedCount: 0, totalCount: 5, status: 'wrong_answer', score: 0,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log(JSON.stringify({
        userId: String(user._id),
        codingQuestionId: String(q._id),
        codingTitle: q.title,
        token,
    }));
    await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
