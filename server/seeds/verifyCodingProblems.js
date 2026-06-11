// Standalone check: run every authored coding problem's reference solution
// against its test inputs and report whether the set is fully gradeable.
// Run: node seeds/verifyCodingProblems.js
require('dotenv').config();

const problems = require('./data/codingProblems');
const { verifyProblem } = require('../utils/codingGrader');

(async () => {
    let ok = 0;
    let bad = 0;
    for (const p of problems) {
        const { testCases, verified, reason } = await verifyProblem(p);
        if (verified) {
            ok += 1;
            const preview = testCases.map((t) => JSON.stringify(t.expectedOutput)).join(' | ');
            console.log(`✅ ${p.title} (${testCases.length} cases) → ${preview.slice(0, 120)}`);
        } else {
            bad += 1;
            console.log(`❌ ${p.title} — ${reason || 'not verified'}`);
        }
    }
    console.log(`\n${ok} verified, ${bad} failed, ${problems.length} total.`);
    process.exit(bad ? 1 : 0);
})();
