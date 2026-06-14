/**
 * seedCompanies.js — CEG / CUIC recruiter roster (idempotent).
 *
 * Unlike seedAll.js (which WIPES collections), this script UPSERTS by company
 * `name` so it can be re-run safely to augment the roster without destroying
 * mentor/admin edits made in-app (Companies page → Add/Edit Company modal).
 *
 * The list is a *representative* roster of firms that recruit at the College of
 * Engineering, Guindy (Anna University) via the CUIC placement cell, spanning
 * IT-services (bulk), product/tech, core engineering and finance/analytics.
 * It is best-effort (the official roster changes yearly) — the placement cell /
 * admin should reconcile it in-app. Eligibility (CGPA / branches / arrears) is
 * filled only where a sensible default is widely known; an unset field is not
 * enforced (see models/Company.js → eligibilitySchema), so blank = open to all.
 *
 *   Run:  node server/seeds/seedCompanies.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('../models/Company');

// Branch codes used by CEG departments (matched against User.department by
// utils/eligibility.checkEligibility). Empty eligibleBranches = all branches.
const CIRCUIT = ['CSE', 'IT', 'ECE', 'EEE', 'EIE'];          // typical software/embedded eligibility
const ALL_CORE = ['MECH', 'CIVIL', 'AUTO', 'PROD', 'CHEM', 'BME'];

const COMPANIES = [
  // ── Product / Tech (dream & super-dream) ──
  { name: 'Google', description: 'Search, cloud and AI leader. DSA + system design heavy interviews; a marquee CEG super-dream recruiter.', interviewPattern: 'Online Assessment → 2 Phone Screens → Onsite (Coding, System Design, Googleyness)', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 8.0, maxActiveArrears: 0, eligibleBranches: CIRCUIT } },
  { name: 'Microsoft', description: 'Recruits heavily from CEG for SDE/Engage roles. Tests problem-solving, coding and design.', interviewPattern: 'OA → 3–4 Rounds (Coding, Design, Behavioral)', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.5, maxActiveArrears: 0, eligibleBranches: CIRCUIT } },
  { name: 'Amazon', description: 'Cloud & e-commerce leader; Leadership Principles + scalable design focus. Regular CEG recruiter.', interviewPattern: 'OA → Phone Screen → 4–5 Loop Interviews (LP + Coding + Design)', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.0, maxActiveArrears: 0, eligibleBranches: CIRCUIT } },
  { name: 'Samsung R&D Institute India', description: 'SRI-B/SRI-Delhi recruit ECE/CSE/EEE for embedded, AI and systems R&D. Strong CEG core+software recruiter.', interviewPattern: 'OA (coding/aptitude) → Technical (2) → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, maxHistoryArrears: 0, eligibleBranches: ['CSE', 'IT', 'ECE', 'EEE', 'EIE'] } },
  { name: 'Zoho', description: 'Chennai-based product company; one of the largest CEG recruiters. Strong emphasis on programming + aptitude.', interviewPattern: 'Online Test → 2–3 Programming Rounds → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.0, eligibleBranches: CIRCUIT } },
  { name: 'Freshworks', description: 'Chennai SaaS unicorn; popular CEG product recruiter for SDE roles.', interviewPattern: 'OA → Machine Coding → Technical (2) → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'PayPal', description: 'Fintech product firm with a Chennai centre; recruits CEG for backend/full-stack.', interviewPattern: 'OA → Technical (2–3) → System Design → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'SAP Labs', description: 'Enterprise software R&D; recruits CEG for development/cloud roles.', interviewPattern: 'OA → Technical (2) → Managerial → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'Cisco', description: 'Networking & systems leader; recruits ECE/CSE/EEE for hardware+software roles.', interviewPattern: 'OA → Technical (2) → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: ['CSE', 'IT', 'ECE', 'EEE', 'EIE'] } },
  { name: 'Adobe', description: 'Creative + document cloud software; problem-solving and OOP design focus.', interviewPattern: 'OA → Technical Rounds (3) → Managerial → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'Walmart Global Tech', description: 'Retail-tech engineering centre; DSA + system design interviews.', interviewPattern: 'OA → 2 Coding → System Design → HR', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'Visa', description: 'Payments technology; backend/data roles for CEG circuit branches.', interviewPattern: 'OA → Technical (2) → HM → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'Salesforce', description: 'CRM cloud leader; Futureforce internships + new-grad SDE.', interviewPattern: 'OA → Technical (2–3) → Behavioral', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: CIRCUIT } },
  { name: 'Oracle', description: 'Enterprise database & cloud. Strong SQL and systems knowledge expected.', interviewPattern: 'OA → 2–3 Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'Qualcomm', description: 'Semiconductor/wireless; recruits ECE/EEE/CSE for chip + embedded roles.', interviewPattern: 'OA → Technical (2–3, domain) → HR', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: ['ECE', 'EEE', 'EIE', 'CSE'] } },
  { name: 'Texas Instruments', description: 'Analog & embedded semiconductor; core ECE/EEE recruiter.', interviewPattern: 'OA → Technical (2, domain) → HR', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: ['ECE', 'EEE', 'EIE'] } },
  { name: 'Intel', description: 'Semiconductor leader; VLSI/embedded + software roles for circuit branches.', interviewPattern: 'OA → Technical (2–3) → HR', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: ['ECE', 'EEE', 'EIE', 'CSE'] } },

  // ── IT services (bulk recruiters) ──
  { name: 'TCS', description: 'India\'s largest IT services firm; bulk CEG recruiter via the NQT exam.', interviewPattern: 'NQT Exam → Technical → Managerial → HR', difficultyLevel: 'Easy', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'Infosys', description: 'IT services major; aptitude + coding basics + communication.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'Wipro', description: 'Global IT services; tests coding, aptitude and domain knowledge.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'Cognizant', description: 'CTS — a top bulk recruiter at CEG; GenC/GenC Next/Elevate tracks.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'Accenture', description: 'Consulting + technology services; large CEG intake.', interviewPattern: 'Cognitive & Technical Assessment → Coding → Communication → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'HCLTech', description: 'IT services & engineering R&D; CEG recruiter for software + core.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'Capgemini', description: 'IT consulting & services; aptitude + pseudocode + technical.', interviewPattern: 'OA (aptitude + pseudocode) → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0, maxActiveArrears: 0 } },
  { name: 'Tech Mahindra', description: 'IT services & telecom solutions; bulk hiring.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'LTIMindtree', description: 'IT services (L&T group); coding + aptitude assessment.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'Mphasis', description: 'Applied-tech IT services; CEG recruiter for dev/support roles.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'Hexaware', description: 'IT & BPS services; aptitude + coding rounds.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'Virtusa', description: 'Digital engineering & IT services; coding + technical interview.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium', eligibility: { cgpaCutoff: 6.0 } },
  { name: 'IBM', description: 'Technology & consulting; software + cloud roles.', interviewPattern: 'Cognitive Assessment → Coding → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.5 } },

  // ── Core engineering (ECE / EEE / MECH / CIVIL / AUTO) ──
  { name: 'Larsen & Toubro', description: 'L&T — engineering & construction conglomerate; core recruiter for MECH/CIVIL/EEE.', interviewPattern: 'OA → Technical (domain) → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.5, eligibleBranches: ['MECH', 'CIVIL', 'EEE', 'EIE', 'AUTO', 'PROD'] } },
  { name: 'Bosch', description: 'Automotive & industrial technology; embedded + core engineering roles.', interviewPattern: 'OA → Technical (2, domain) → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0, eligibleBranches: ['ECE', 'EEE', 'EIE', 'MECH', 'AUTO', 'CSE'] } },
  { name: 'Ford', description: 'Automotive engineering & software (Ford Business Solutions, Chennai).', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: ['MECH', 'AUTO', 'ECE', 'EEE', 'CSE', 'IT'] } },
  { name: 'Caterpillar', description: 'Heavy machinery R&D; core MECH/design recruiter.', interviewPattern: 'OA → Technical (domain) → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: ['MECH', 'AUTO', 'PROD'] } },
  { name: 'Ashok Leyland', description: 'Commercial vehicles (Hinduja group, Chennai); core MECH/AUTO/EEE.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.5, eligibleBranches: ['MECH', 'AUTO', 'EEE', 'PROD'] } },
  { name: 'TVS Motor', description: 'Two-wheeler manufacturer; design/R&D/production roles.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.5, eligibleBranches: ['MECH', 'AUTO', 'EEE', 'PROD'] } },
  { name: 'Schneider Electric', description: 'Energy management & automation; EEE/EIE/ECE core roles.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: ['EEE', 'EIE', 'ECE', 'MECH'] } },

  // ── Finance / analytics / consulting ──
  { name: 'Goldman Sachs', description: 'Investment-banking technology; DSA + aptitude + problem solving.', interviewPattern: 'OA (Aptitude + Coding) → Technical (2–3) → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: CIRCUIT } },
  { name: 'Morgan Stanley', description: 'Financial services technology; strong CS fundamentals + design.', interviewPattern: 'OA → Technical (2–3) → HR', difficultyLevel: 'Hard', eligibility: { cgpaCutoff: 7.5, eligibleBranches: CIRCUIT } },
  { name: 'Wells Fargo', description: 'Banking technology centre (Chennai/Hyderabad/Bengaluru); software roles.', interviewPattern: 'OA → Technical (2) → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 7.0, eligibleBranches: CIRCUIT } },
  { name: 'ZS Associates', description: 'Management consulting & analytics; case + analytics + aptitude.', interviewPattern: 'Aptitude → Case/Analytics → Technical → HR', difficultyLevel: 'Medium-Hard', eligibility: { cgpaCutoff: 7.0 } },
  { name: 'Deloitte', description: 'Big-Four consulting; mix of technical and case-study interviews.', interviewPattern: 'OA → Group Discussion → Technical → Case Study → HR', difficultyLevel: 'Medium', eligibility: { cgpaCutoff: 6.5 } },
];

async function seedCompanies() {
  if (!process.env.MONGODB_URI) {
    console.error('✗ MONGODB_URI is not set in server/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🔗 Connected to MongoDB');

  let upserted = 0;
  for (const c of COMPANIES) {
    const { name, ...rest } = c;
    // Upsert by unique name: re-runs refresh details without duplicating or
    // wiping admin-edited rows that aren't in this list.
    const res = await Company.updateOne(
      { name },
      { $set: rest, $setOnInsert: { name } },
      { upsert: true }
    );
    if (res.upsertedCount) upserted += 1;
  }

  const total = await Company.countDocuments();
  console.log(`   ✅ Upserted ${COMPANIES.length} companies (${upserted} new). Total in DB: ${total}.`);
  console.log('   ℹ️  Reconcile against the official CUIC list via the Companies page (Add/Edit).');
  await mongoose.disconnect();
}

seedCompanies().catch((err) => {
  console.error('✗ seedCompanies failed:', err.message);
  process.exit(1);
});
