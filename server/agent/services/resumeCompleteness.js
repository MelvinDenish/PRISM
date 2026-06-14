/**
 * Resume completeness gate — the DETERMINISTIC heart of the gap-aware intake.
 *
 * Pure functions only: no LLM, no I/O. The intake chat (resumeIntake.js) uses the
 * LLM merely to extract fields from the user's last answer and to phrase the next
 * question; THIS module decides — by presence/count, never by judgment — whether
 * enough is collected to author a strong resume. The /author route re-runs
 * `assessCompleteness` as the real wall (a disabled client button is only UX).
 *
 * `collected` is the accumulating resume-content object (same shape the design
 * pipeline consumes):
 *   { personalInfo {fullName,email,phone,location,linkedin,github,portfolio,summary},
 *     education [{institution,degree,field,startDate,endDate,gpa}],
 *     experience [{company,position,startDate,endDate,current,description}],
 *     projects [{name,description,technologies,link}],
 *     skills [string], certifications [{name,issuer,date}],
 *     achievements [string], positionsOfResponsibility [string],
 *     languages [string], hobbies [string],
 *     cgpa, tenthPercent, twelfthPercent, registerNumber }
 */

// ── Gate thresholds (tunable) ───────────────────────────────────────────────
// NOTE: `enoughContent` (the word count below) is ADVISORY — it nudges the chat and
// powers the "Draft my project details" assist, but it does NOT block generation.
// A genuinely thin project brief can't always be truthfully expanded to this many
// words, so holding the gate on it would trap exactly the user the assist is for.
const MIN_CONTENT_WORDS = 200; // ~enough substance to fill a single A4 resume body
const MIN_PROJECTS = 2;        // freshers may lack experience → projects carry the resume
const MIN_SKILLS = 3;

const norm = (v) => String(v == null ? '' : v).trim();
const filled = (v) => norm(v).length > 0;
const wordCount = (s) => norm(s).split(/\s+/).filter(Boolean).length;

function validProjects(c = {}) {
  return (c.projects || []).filter((p) => p && filled(p.name) && filled(p.description));
}
function filledSkills(c = {}) {
  return (c.skills || []).filter(filled);
}

/**
 * Deterministic proxy for "fills a page": total words across the substance
 * sections. Drives the `enoughContent` gate item so the chat keeps deepening
 * project briefs until there's enough to author a full A4.
 */
function estimateContentWords(c = {}) {
  let n = wordCount(c.personalInfo && c.personalInfo.summary);
  (c.projects || []).forEach((p) => { n += wordCount(p && p.description); });
  (c.experience || []).forEach((e) => { n += wordCount(e && e.description); });
  (c.achievements || []).forEach((a) => { n += wordCount(a); });
  (c.positionsOfResponsibility || []).forEach((a) => { n += wordCount(a); });
  return n;
}

/**
 * Score `collected` against the quality bar. Returns the checklist split into
 * `have` / `missing` (missing is in PRIORITY order — projects & content first, so
 * the intake asks for the highest-impact gap next) plus `gateMet` and the raw
 * `contentScore`. `profile` is accepted for parity/future use; academics already
 * live in `collected` (seeded from the profile).
 */
function assessCompleteness(collected = {}, profile = {}) { // eslint-disable-line no-unused-vars
  const c = collected || {};
  const pi = c.personalInfo || {};
  const projOk = validProjects(c).length;
  const skillOk = filledSkills(c).length;
  const contentScore = estimateContentWords(c);
  const needProj = Math.max(0, MIN_PROJECTS - projOk);

  const items = [
    {
      key: 'projects',
      label: `${MIN_PROJECTS}+ projects with a brief`,
      done: projOk >= MIN_PROJECTS,
      hint: needProj === 0
        ? 'Projects added.'
        : `Add ${needProj} more project${needProj === 1 ? '' : 's'} — the name, the problem it solves, and what you built (tech + your role).`,
    },
    {
      key: 'enoughContent',
      label: 'Enough detail to fill a page',
      done: contentScore >= MIN_CONTENT_WORDS,
      hint: 'Add a couple more sentences to your projects (impact, tech used, your role) so the resume fills an A4.',
    },
    {
      key: 'academics',
      label: 'CGPA, 10th % and 12th %',
      done: filled(c.cgpa) && filled(c.tenthPercent) && filled(c.twelfthPercent),
      hint: 'Share your degree CGPA and your 10th and 12th percentages (required by CUIC).',
    },
    {
      key: 'education',
      label: 'Education (institution + degree)',
      done: (c.education || []).some((e) => e && filled(e.institution) && filled(e.degree)),
      hint: 'Name your college and the degree you are pursuing (e.g. B.Tech in CSE).',
    },
    {
      key: 'skills',
      label: `${MIN_SKILLS}+ skills`,
      done: skillOk >= MIN_SKILLS,
      hint: `List at least ${MIN_SKILLS} skills — programming languages, frameworks, and tools.`,
    },
    {
      key: 'identity',
      label: 'Name & email',
      done: filled(pi.fullName) && filled(pi.email),
      hint: 'Confirm your full name and a contact email.',
    },
    {
      key: 'links',
      label: 'LinkedIn or GitHub',
      done: filled(pi.linkedin) || filled(pi.github),
      hint: 'Add at least one of your LinkedIn or GitHub profile links.',
    },
  ];

  const have = items.filter((i) => i.done).map(({ key, label }) => ({ key, label }));
  const missing = items.filter((i) => !i.done).map(({ key, label, hint }) => ({ key, label, hint }));
  // `enoughContent` is advisory: it stays in `missing` so the checklist nudges and the
  // Draft assist offers to thicken it, but generation is gated on the FACTUAL items
  // only. (The /author route uses this same `gateMet`, so client and server agree.)
  const gateMet = items.every((i) => i.key === 'enoughContent' || i.done);
  return { have, missing, gateMet, contentScore };
}

// ── Seed: profile → initial collected (no invention) ────────────────────────
/**
 * Build the starting `collected` object from the user's saved profile so the chat
 * never re-asks what's already on file (name, email, links, college, academics,
 * skills). Only maps known facts — leaves everything else empty.
 */
function seedCollectedFromProfile(profile = {}) {
  const p = profile || {};
  const education = filled(p.college)
    ? [{
      institution: norm(p.college),
      degree: '',
      field: norm(p.department),
      startDate: '',
      endDate: p.graduationYear ? String(p.graduationYear) : '',
      gpa: norm(p.cgpa),
    }]
    : [];
  return {
    personalInfo: {
      fullName: norm(p.name),
      email: norm(p.email),
      phone: '',
      location: '',
      linkedin: norm(p.linkedin),
      github: norm(p.github),
      portfolio: '',
      summary: '',
    },
    education,
    experience: [],
    projects: [],
    skills: Array.isArray(p.skills) ? p.skills.map(norm).filter(Boolean) : [],
    certifications: [],
    achievements: [],
    positionsOfResponsibility: [],
    languages: [],
    hobbies: [],
    cgpa: norm(p.cgpa),
    tenthPercent: norm(p.tenthPercent),
    twelfthPercent: norm(p.twelfthPercent),
    registerNumber: norm(p.registerNumber),
  };
}

// ── Merge: accumulate the LLM's per-turn DELTA into collected ────────────────
// The model emits ONLY new facts from the user's latest message (never cumulative
// state), so the merge is append/update — this is what makes a 10-turn chat
// amnesia-proof.

function mergePersonalInfo(prev = {}, delta = {}) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(delta || {})) {
    if (filled(v)) out[k] = norm(v);
  }
  return out;
}

// Update an existing entry when the delta shares an identity key (case-insensitive,
// e.g. a project named the same), else append. Lets the user add a project's name
// on one turn and its description on the next without creating a duplicate.
function mergeObjectArray(prev, delta, idKeys) {
  const out = Array.isArray(prev) ? prev.map((x) => ({ ...x })) : [];
  for (const d of (Array.isArray(delta) ? delta : [])) {
    if (!d || typeof d !== 'object') continue;
    const idVal = idKeys.map((k) => norm(d[k]).toLowerCase()).find(Boolean);
    let idx = -1;
    if (idVal) {
      idx = out.findIndex((x) => idKeys.some((k) => {
        const xv = norm(x[k]).toLowerCase();
        return xv && xv === idVal;
      }));
    }
    if (idx >= 0) {
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'boolean' || (Array.isArray(v) && v.length) || filled(v)) out[idx][k] = v;
      }
    } else {
      out.push({ ...d });
    }
  }
  return out;
}

// Case-insensitive union of string arrays (preserves the first-seen casing).
function mergeStringArray(prev, delta) {
  const seen = new Set();
  const out = [];
  for (const v of [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(delta) ? delta : [])]) {
    const s = norm(v);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Deterministically fold a per-turn delta into the accumulated collected object. */
function mergeCollected(prev, delta) {
  const p = prev || {};
  const d = delta || {};
  const out = { ...p };
  out.personalInfo = mergePersonalInfo(p.personalInfo, d.personalInfo);
  out.education = mergeObjectArray(p.education, d.education, ['institution', 'degree']).slice(0, 10);
  out.experience = mergeObjectArray(p.experience, d.experience, ['company', 'position']).slice(0, 15);
  out.projects = mergeObjectArray(p.projects, d.projects, ['name']).slice(0, 15);
  out.certifications = mergeObjectArray(p.certifications, d.certifications, ['name']).slice(0, 15);
  out.skills = mergeStringArray(p.skills, d.skills).slice(0, 50);
  out.achievements = mergeStringArray(p.achievements, d.achievements).slice(0, 30);
  out.positionsOfResponsibility = mergeStringArray(p.positionsOfResponsibility, d.positionsOfResponsibility).slice(0, 30);
  out.languages = mergeStringArray(p.languages, d.languages).slice(0, 15);
  out.hobbies = mergeStringArray(p.hobbies, d.hobbies).slice(0, 15);
  for (const k of ['cgpa', 'tenthPercent', 'twelfthPercent', 'registerNumber']) {
    if (filled(d[k])) out[k] = norm(d[k]);
  }
  return out;
}

module.exports = {
  assessCompleteness,
  seedCollectedFromProfile,
  mergeCollected,
  estimateContentWords,
  MIN_CONTENT_WORDS,
  MIN_PROJECTS,
  MIN_SKILLS,
};
