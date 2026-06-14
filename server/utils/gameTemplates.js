// P8 targeted Interview Game — round composition templates.
//
// The six round TYPES are fixed (aptitude, technical1, technical2, coding, gd, hr)
// so existing grading / attempts / code-execution are untouched. A template only
// controls, per round: how many questions (`count`), which QuestionBank categories
// to bias toward (`categoryWeights`), and an optional per-round difficulty override.
//
// Composition is a deterministic, name-keyed lookup over the seeded companies + a
// role-family fallback. `Company.interviewPattern` is free text and is NOT parsed
// here — it's display context / HR-personalization input only.
//
// categoryWeights reference real seeded categories (confirmed against the bank):
//   aptitude : arithmetic logical data-interpretation percentages probability series time-speed-distance verbal
//   technical: algorithms dbms dsa networks oop os system-design

const ROLE_FAMILIES = {
  sde: {
    label: 'Software Engineer',
    rounds: {
      aptitude: { count: 15, categoryWeights: { logical: 2, arithmetic: 2, series: 1, 'data-interpretation': 1 } },
      technical1: { count: 10, categoryWeights: { dsa: 3, algorithms: 3, oop: 1 } },
      technical2: { count: 10, categoryWeights: { 'system-design': 2, os: 2, dbms: 2, networks: 1 } },
      coding: { count: 2 },
      gd: {},
      hr: { count: 10 },
    },
  },
  frontend: {
    label: 'Frontend Engineer',
    rounds: {
      aptitude: { count: 15, categoryWeights: { logical: 2, arithmetic: 1, verbal: 1 } },
      technical1: { count: 10, categoryWeights: { oop: 3, dsa: 2, algorithms: 1 } },
      technical2: { count: 10, categoryWeights: { 'system-design': 3, networks: 2, dbms: 1 } },
      coding: { count: 2 },
      gd: {},
      hr: { count: 10 },
    },
  },
  data: {
    label: 'Data / Analytics',
    rounds: {
      aptitude: { count: 15, categoryWeights: { 'data-interpretation': 3, probability: 2, percentages: 2, arithmetic: 1 } },
      technical1: { count: 10, categoryWeights: { dbms: 3, algorithms: 2, dsa: 1 } },
      technical2: { count: 10, categoryWeights: { dbms: 2, os: 1, 'system-design': 1 } },
      coding: { count: 2 },
      gd: {},
      hr: { count: 10 },
    },
  },
  core: {
    label: 'Core CS / Service',
    rounds: {
      aptitude: { count: 15, categoryWeights: { arithmetic: 2, logical: 2, verbal: 2, series: 1, percentages: 1 } },
      technical1: { count: 10, categoryWeights: { os: 2, dbms: 2, networks: 2, oop: 2 } },
      technical2: { count: 10, categoryWeights: { dbms: 2, oop: 2, networks: 1, dsa: 1 } },
      coding: { count: 2 },
      gd: {},
      hr: { count: 10 },
    },
  },
};

// Known seeded companies → role family + a default difficulty bias. Unknown
// companies fall through to role inference + 'medium'.
const COMPANY_MAP = {
  google: { roleFamily: 'sde', difficulty: 'hard' },
  amazon: { roleFamily: 'sde', difficulty: 'hard' },
  microsoft: { roleFamily: 'sde', difficulty: 'hard' },
  meta: { roleFamily: 'sde', difficulty: 'hard' },
  facebook: { roleFamily: 'sde', difficulty: 'hard' },
  apple: { roleFamily: 'sde', difficulty: 'hard' },
  netflix: { roleFamily: 'sde', difficulty: 'hard' },
  flipkart: { roleFamily: 'sde', difficulty: 'hard' },
  uber: { roleFamily: 'sde', difficulty: 'hard' },
  adobe: { roleFamily: 'sde', difficulty: 'medium' },
  goldman: { roleFamily: 'data', difficulty: 'hard' },
  'goldman sachs': { roleFamily: 'data', difficulty: 'hard' },
  tcs: { roleFamily: 'core', difficulty: 'easy' },
  infosys: { roleFamily: 'core', difficulty: 'easy' },
  wipro: { roleFamily: 'core', difficulty: 'easy' },
  cognizant: { roleFamily: 'core', difficulty: 'medium' },
  accenture: { roleFamily: 'core', difficulty: 'medium' },
  capgemini: { roleFamily: 'core', difficulty: 'easy' },
  'hcl': { roleFamily: 'core', difficulty: 'easy' },
  'tech mahindra': { roleFamily: 'core', difficulty: 'easy' },
};

const VALID_DIFF = ['easy', 'medium', 'hard'];

// Guess a role family from a free-text role string.
function inferRoleFamily(role) {
  const r = String(role || '').toLowerCase();
  if (/front|react|angular|vue|ui|web/.test(r)) return 'frontend';
  if (/data|ml|machine|analyt|scien|ai\b/.test(r)) return 'data';
  if (/back|sde|software|full.?stack|engineer|developer|devops|platform/.test(r)) return 'sde';
  return null;
}

/**
 * Resolve a round-composition template.
 * @param {{ companyName?: string, role?: string, difficulty?: string }} opts
 * @returns {{ roleFamily, label, company, difficulty, rounds }}
 *   `rounds[type]` = { count, categoryWeights?, difficulty } with difficulty
 *   resolved to a concrete value for every round.
 */
function resolveTemplate({ companyName, role, difficulty } = {}) {
  const key = String(companyName || '').trim().toLowerCase();
  const companyCfg = COMPANY_MAP[key];
  const roleFamily = companyCfg?.roleFamily || inferRoleFamily(role) || 'core';
  const family = ROLE_FAMILIES[roleFamily] || ROLE_FAMILIES.core;

  // Explicit difficulty wins; else the company bias; else medium.
  const diff = VALID_DIFF.includes(difficulty) ? difficulty
    : (companyCfg?.difficulty || 'medium');

  const rounds = {};
  for (const [type, cfg] of Object.entries(family.rounds)) {
    rounds[type] = { ...cfg, difficulty: VALID_DIFF.includes(cfg.difficulty) ? cfg.difficulty : diff };
  }

  return {
    roleFamily,
    label: family.label,
    company: companyName || '',
    difficulty: diff,
    rounds,
  };
}

// Map an overall readiness score (0–100) to a default difficulty.
function difficultyFromReadiness(overall) {
  const n = Number(overall);
  if (!Number.isFinite(n) || n === 0) return 'medium';
  if (n < 40) return 'easy';
  if (n < 70) return 'medium';
  return 'hard';
}

module.exports = { resolveTemplate, difficultyFromReadiness, inferRoleFamily, ROLE_FAMILIES, COMPANY_MAP };
