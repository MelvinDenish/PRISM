/**
 * CUIC (Anna University placement cell) resume rules.
 *
 * Ground truth from from_cuic/Resume_Guidelines.png + the placement policy PDF:
 *   - PDF mandatory, named `RegisterNumber_Name.pdf`.
 *   - Sections: Header (with LinkedIn/GitHub), Education (CGPA + 10th/12th %),
 *     Skills (Languages / Frameworks / Tools), Projects (Problem & Solution),
 *     Internships.
 *
 * Shared so the export route (filename) and any checklist surface agree on one
 * definition. The client renders its own checklist; this is the server anchor.
 */

// Strip anything unsafe for a filename and collapse whitespace. Keeps letters,
// digits, dot and dash; spaces are removed (CUIC names are CamelCase-ish).
const sanitizePart = (s) => String(s == null ? '' : s)
  .trim()
  .replace(/[^A-Za-z0-9.-]+/g, '')
  .slice(0, 60);

/**
 * Build the CUIC-compliant export filename `RegisterNumber_Name.ext`.
 * Falls back to just the (sanitized) name when no register number is on file, so
 * a student who hasn't filled their Profile yet still gets a sensible filename.
 * @param {{ registerNumber?: string, name?: string, format?: string }} opts
 * @returns {string}
 */
function cuicFileName({ registerNumber, name, format = 'pdf' } = {}) {
  const reg = sanitizePart(registerNumber);
  const nm = sanitizePart(name) || 'Resume';
  const ext = String(format || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const base = reg ? `${reg}_${nm}` : nm;
  return `${base}.${ext}`;
}

// Required CUIC sections + how to detect them on a ResumeDraft. Used by the
// client checklist (shipped via GET /resume-builder/cuic-checklist) and tests.
const CUIC_SECTIONS = [
  { key: 'header', label: 'Header with LinkedIn & GitHub', hint: 'Add both your LinkedIn and GitHub links to the header.' },
  { key: 'education', label: 'Education with CGPA and 10th/12th %', hint: 'List your degree CGPA plus your 10th and 12th percentages.' },
  { key: 'skills', label: 'Skills (Languages / Frameworks / Tools)', hint: 'Group skills into Languages, Frameworks, and Tools.' },
  { key: 'projects', label: 'Projects (Problem & Solution)', hint: 'For each project, describe the problem and your solution.' },
  { key: 'internships', label: 'Internships / Experience', hint: 'Add at least one internship or work experience entry.' },
];

/**
 * Evaluate a ResumeDraft against the CUIC section checklist. Best-effort, purely
 * structural — returns one row per required section with a boolean `done`.
 * @param {object} draft  ResumeDraft-shaped object
 * @returns {{ items: Array<{key,label,hint,done}>, complete: boolean }}
 */
function cuicChecklist(draft = {}) {
  const p = draft.personalInfo || {};
  const skillsText = (draft.skills || []).join(' ').toLowerCase();
  const eduHasMarks = (draft.education || []).some((e) => e && (e.gpa || /10th|12th|%|percent/i.test([e.field, e.degree, e.institution].filter(Boolean).join(' '))));
  const checks = {
    header: Boolean(p.linkedin) && Boolean(p.github),
    education: (draft.education || []).some((e) => e && e.institution) && eduHasMarks,
    skills: (draft.skills || []).length >= 3,
    projects: (draft.projects || []).some((pr) => pr && pr.name && pr.description),
    internships: (draft.experience || []).some((e) => e && e.company),
  };
  // Soft signal: encourage the Languages/Frameworks/Tools grouping if present.
  checks.skills = checks.skills && (/lang|framework|tool|java|python|react|node|sql|c\+\+/.test(skillsText) || (draft.skills || []).length >= 5);

  const items = CUIC_SECTIONS.map((s) => ({ ...s, done: Boolean(checks[s.key]) }));
  return { items, complete: items.every((i) => i.done) };
}

module.exports = { cuicFileName, cuicChecklist, CUIC_SECTIONS, sanitizePart };
