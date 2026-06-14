/**
 * Phase 0 (quick wins) headless verification.
 *   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyPhase0.js
 *
 * Asserts:
 *  P0.1 mentee nav drops Resources (mentor/admin keep it); behavioral-practice linked.
 *  P0.2 /api/behavioral-practice question source has data; route wired in server.js.
 *  P0.3 CUIC filename is `RegisterNumber_Name.pdf`; checklist + endpoint present.
 *  P0.4 seedDSA populated the 7 DSA topics + verified coding questions.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

async function main() {
  console.log('— P0.1 sidebar / nav —');
  const sidebar = read('client/src/components/Sidebar.jsx');
  const menteeBlock = sidebar.slice(sidebar.indexOf('menteeNav'), sidebar.indexOf('mentorNav'));
  ok(!/to:\s*'\/resources'/.test(menteeBlock), 'mentee nav does NOT link /resources');
  ok(/to:\s*'\/behavioral-practice'/.test(menteeBlock), 'mentee nav links /behavioral-practice');
  ok(/to:\s*'\/topics'/.test(menteeBlock), 'mentee nav still links /topics');
  const mentorAdmin = sidebar.slice(sidebar.indexOf('mentorNav'));
  ok(/to:\s*'\/resources'/.test(mentorAdmin), 'mentor/admin nav still links /resources');

  console.log('— P0.2 behavioral practice —');
  const server = read('server/server.js');
  ok(/behavioral-practice'\s*,\s*require\('\.\/routes\/behavioralPractice'\)/.test(server), 'behavioral-practice route registered in server.js');
  const app = read('client/src/App.jsx');
  ok(/path="behavioral-practice"/.test(app), 'behavioral-practice route in App.jsx');
  ok(/path="behavioral"/.test(app), 'STAR Bank /behavioral route still present (parallel)');
  require('../routes/behavioralPractice'); ok(true, 'behavioralPractice route requires cleanly');
  const SkillSignal = require('../models/SkillSignal');
  ok(SkillSignal.SOURCES.includes('behavioral_practice'), 'behavioral_practice registered in SkillSignal.SOURCES');

  console.log('— P0.3 CUIC resume —');
  const { cuicFileName, cuicChecklist } = require('../utils/cuicResume');
  ok(cuicFileName({ registerNumber: '2021CS001', name: 'John Doe', format: 'pdf' }) === '2021CS001_JohnDoe.pdf', 'filename = RegisterNumber_Name.pdf');
  ok(cuicFileName({ name: 'John Doe', format: 'pdf' }) === 'JohnDoe.pdf', 'filename falls back to Name when no register number');
  const full = cuicChecklist({ personalInfo: { linkedin: 'x', github: 'y' }, education: [{ institution: 'CEG', gpa: '9.1' }], skills: ['Java', 'Python', 'React', 'SQL', 'Git'], projects: [{ name: 'P', description: 'solves X' }], experience: [{ company: 'Acme' }] });
  ok(full.complete === true, 'a complete CUIC resume passes the checklist');
  const empty = cuicChecklist({});
  ok(empty.complete === false && empty.items.length === 5, 'an empty resume fails (5 required sections)');

  console.log('— P0.4 DSA seed (DB) —');
  await mongoose.connect(process.env.MONGODB_URI);
  const Topic = require('../models/Topic');
  const CodingQuestion = require('../models/CodingQuestion');
  const QuestionBank = require('../models/QuestionBank');
  const DSA = ['Arrays', 'Strings', 'Stack and Queue', 'Heap and Recursion', 'Linked List and Binary Tree', 'Binary Search Trees and Greedy', 'Dynamic Programming'];
  let topicsOk = true;
  for (const n of DSA) { if (await Topic.countDocuments({ name: n }) !== 1) topicsOk = false; }
  ok(topicsOk, 'all 7 DSA topics exist exactly once');
  const twoSum = await CodingQuestion.findOne({ title: 'Two Sum' });
  ok(twoSum && twoSum.verified && twoSum.testCases.length > 0, 'Two Sum seeded, verified, has test cases');
  ok(twoSum && twoSum.testCases.every((t) => t.expectedOutput && t.expectedOutput.length), 'verified test cases have reference-produced expected outputs');
  const hrCount = await QuestionBank.countDocuments({ type: 'hr', verified: true });
  ok(hrCount >= 3, `behavioral practice has HR prompts to serve (${hrCount} in bank)`);

  console.log(`\n${fail ? '❌' : '🎯'} Phase 0: ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
