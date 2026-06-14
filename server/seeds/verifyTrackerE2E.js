// Throwaway end-to-end check for the coding-practice tracker (C2).
// Proves, against the REAL database, that: a verified problem grades a correct
// submission as Accepted and a wrong one as not, that CodeSubmission docs are
// written, and that the /progress solved-derivation sees the solved problem.
// Inserts temp docs under a temp user and removes them — does NOT touch seeded data.
require('dotenv').config();
const mongoose = require('mongoose');
const CodingQuestion = require('../models/CodingQuestion');
const CodeSubmission = require('../models/CodeSubmission');
const authored = require('./data/codingProblems');
const { verifyProblem, gradeSubmission } = require('../utils/codingGrader');

const CORRECT = `k=int(input())\narr=list(map(int,input().split()))\nt=int(input())\nseen={}\nfor i,x in enumerate(arr):\n    if t-x in seen:\n        print(seen[t-x], i); break\n    if x not in seen: seen[x]=i\n`;
const WRONG = `print("0 0")\n`;

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = new mongoose.Types.ObjectId();
    let problem;
    try {
        const src = authored.find((p) => p.title === 'Two Sum');
        const { testCases, verified } = await verifyProblem(src);
        if (!verified) throw new Error('reference verification failed');

        problem = await CodingQuestion.create({
            title: '[E2E TEMP] Two Sum', description: src.description, difficulty: 'easy',
            category: src.category, testCases, boilerplate: src.boilerplate,
            referenceSolution: src.reference, verified: true,
        });
        console.log(`Inserted temp problem ${problem._id} with ${testCases.length} verified test cases`);

        // Correct submission → Accepted
        const okGrade = await gradeSubmission({ testCases: problem.testCases, language: 'python', code: CORRECT });
        const okSub = await CodeSubmission.create({
            question: problem._id, user: userId, code: CORRECT, language: 'python',
            passed: okGrade.passed, passedCount: okGrade.passedCount, totalCount: okGrade.totalCount,
            status: okGrade.status, score: okGrade.score,
        });
        console.log(`Correct submission: status=${okGrade.status} ${okGrade.passedCount}/${okGrade.totalCount} score=${okGrade.score} (doc ${okSub._id})`);

        // Wrong submission → not accepted
        const badGrade = await gradeSubmission({ testCases: problem.testCases, language: 'python', code: WRONG });
        console.log(`Wrong submission:   status=${badGrade.status} ${badGrade.passedCount}/${badGrade.totalCount} score=${badGrade.score}`);

        // Solved-derivation (same query the /progress route uses)
        const solvedIds = await CodeSubmission.distinct('question', { user: userId, passed: true });
        const solved = solvedIds.map(String).includes(String(problem._id));

        // Inspect the persisted doc
        const persisted = await CodeSubmission.findById(okSub._id).lean();

        const pass =
            okGrade.passed === true &&
            okGrade.status === 'accepted' &&
            badGrade.passed === false &&
            solved === true &&
            persisted && persisted.passed === true;

        console.log('\n--- RESULTS ---');
        console.log('Correct graded Accepted:', okGrade.passed === true && okGrade.status === 'accepted');
        console.log('Wrong graded not-accepted:', badGrade.passed === false);
        console.log('Solved-derivation sees problem:', solved);
        console.log('Persisted CodeSubmission.passed:', persisted?.passed);
        console.log(pass ? '\n✅ E2E PASS' : '\n❌ E2E FAIL');

        // Cleanup
        await CodeSubmission.deleteMany({ user: userId });
        await CodingQuestion.findByIdAndDelete(problem._id);
        console.log('Cleaned up temp docs.');
        process.exit(pass ? 0 : 1);
    } catch (e) {
        if (problem) { try { await CodeSubmission.deleteMany({ user: userId }); await CodingQuestion.findByIdAndDelete(problem._id); } catch {} }
        console.error('E2E error:', e.message);
        process.exit(1);
    }
})();
