/**
 * Phase 1 (Profile + eligibility) headless verification.
 *   node seeds/verifyPhase1.js   (no DB needed — pure logic + schema introspection)
 */
const { checkEligibility } = require('../utils/eligibility');
const User = require('../models/User');
const Company = require('../models/Company');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); } };

console.log('— models —');
for (const f of ['registerNumber', 'cgpa', 'activeArrears', 'historyArrears', 'tenthPercent', 'twelfthPercent', 'department', 'batch']) {
  ok(User.schema.path(f) !== undefined, `User.${f} exists`);
}
ok(User.schema.path('cgpa').instance === 'Number', 'User.cgpa is a Number');
ok(Company.schema.path('eligibility') !== undefined, 'Company.eligibility subdoc exists');
ok(Company.schema.path('eligibility.cgpaCutoff') !== undefined, 'Company.eligibility.cgpaCutoff exists');

console.log('— eligibility checker —');
const COMP = { eligibility: { cgpaCutoff: 7.0, maxActiveArrears: 0, tenthMin: 60, twelfthMin: 60, eligibleBranches: ['CSE', 'IT'] } };

let r = checkEligibility({ cgpa: 8.2, activeArrears: 0, tenthPercent: 85, twelfthPercent: 90, department: 'CSE' }, COMP);
ok(r.eligible && !r.unknown && r.reasons.length === 0, 'strong candidate is eligible');

r = checkEligibility({ cgpa: 6.5, activeArrears: 0, tenthPercent: 85, twelfthPercent: 90, department: 'CSE' }, COMP);
ok(!r.eligible && !r.unknown && /CGPA/.test(r.reasons[0]), 'low CGPA → not eligible with reason');

r = checkEligibility({ cgpa: 8.0, activeArrears: 2, tenthPercent: 85, twelfthPercent: 90, department: 'CSE' }, COMP);
ok(!r.eligible && /arrear/i.test(r.reasons.join(' ')), 'active arrears over limit → not eligible');

r = checkEligibility({ cgpa: 8.0, activeArrears: 0, tenthPercent: 85, twelfthPercent: 90, department: 'MECH' }, COMP);
ok(!r.eligible && /branch/i.test(r.reasons.join(' ')), 'wrong branch → not eligible');

r = checkEligibility({ activeArrears: 0, tenthPercent: 85, twelfthPercent: 90, department: 'CSE' }, COMP);
ok(!r.eligible && r.unknown && r.missing.includes('CGPA'), 'missing CGPA → unknown (prompt to complete profile)');

r = checkEligibility({ cgpa: 5.0 }, {});
ok(r.eligible && !r.hasCriteria, 'company with no criteria is open to all');

r = checkEligibility({ cgpa: 9.0, department: 'cse' }, { eligibility: { eligibleBranches: ['CSE'] } });
ok(r.eligible, 'branch match is case/format-insensitive (cse == CSE)');

console.log('— route modules —');
require('../routes/users'); ok(true, 'users route requires cleanly');
require('../routes/companies'); ok(true, 'companies route requires cleanly');
const usersSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'routes', 'users.js'), 'utf8');
ok(/router\.put\('\/me'/.test(usersSrc), 'PUT /api/users/me exists');
ok(!/ME_STRING_FIELDS[\s\S]*'role'/.test(usersSrc.slice(usersSrc.indexOf('ME_STRING_FIELDS'), usersSrc.indexOf('router.put'))), 'me whitelist does NOT include role');

console.log(`\n${fail ? '❌' : '🎯'} Phase 1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
