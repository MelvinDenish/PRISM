/**
 * Shared resume services for the assistant.
 *
 *  analyzeResume — pure analysis (Gemini → keyword fallback), no persistence/PDF.
 *                  Extracted from routes/resumeAnalysis.js so the route and the
 *                  assistant's analyze_resume tool score identically.
 *  rewriteResume — NET-NEW capability: take resume text + a job description and
 *                  produce an improved, JD-tailored resume as a structured
 *                  ResumeDraft (opens in the existing Resume Builder). This is the
 *                  "rewrite it for me" the plan calls out; it is the confirm-gate
 *                  executor and only persists on the user's confirmation.
 */

const llm = require('../llm');
const { config } = require('../../config/env');
const ResumeDraft = require('../../models/ResumeDraft');
const { emit: emitSignals } = require('./signals');

const MAX_INPUT = 20000;

const STOPWORDS = new Set([
  'this', 'that', 'with', 'have', 'will', 'your', 'from', 'they', 'their', 'about',
  'which', 'would', 'there', 'been', 'were', 'when', 'what', 'into', 'than', 'them',
  'then', 'some', 'such', 'only', 'also', 'more', 'most', 'other', 'must', 'should',
  'role', 'work', 'team', 'years', 'year', 'using', 'used', 'strong', 'good', 'plus',
  'looking', 'experience', 'preferred', 'required', 'skills', 'ability', 'knowledge',
]);

function keywordAnalysis(resumeText, jobDescription) {
  const jdWords = jobDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/));
  const unique = [...new Set(jdWords)];
  const allMissing = unique.filter((w) => !resumeWords.has(w));
  const matchScore = unique.length > 0 ? Math.round(((unique.length - allMissing.length) / unique.length) * 100) : 0;
  const redFlags = [];
  if (resumeText.length < 300) redFlags.push('Resume looks very short — add more detail on projects and impact.');
  if (!/\d/.test(resumeText)) redFlags.push('No numbers/metrics found — quantify your achievements (e.g. "improved latency by 30%").');
  return {
    matchScore,
    missingKeywords: allMissing.slice(0, 20),
    suggestions: `Keyword analysis: your resume covers ${unique.length - allMissing.length} of ${unique.length} key terms from the job description. Add the missing keywords where they genuinely apply, and mirror the JD's wording.`,
    redFlags,
    starSuggestions: [],
  };
}

async function geminiAnalysis(resumeText, jobDescription) {
  const prompt = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze the following resume against the job description and provide a structured JSON response.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond ONLY with a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "matchScore": <number 0-100 representing ATS match percentage>,
  "missingKeywords": [<array of important keywords found in JD but missing from resume>],
  "redFlags": [<array of ATS formatting issues>],
  "suggestions": "<detailed paragraph with improvement suggestions>",
  "starSuggestions": [<array of STAR-method rewrite suggestions for existing bullet points>]
}`;

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } }) }
    );
  } catch { return null; }
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { return null; }
  const matchScore = Number(parsed.matchScore) || 0;
  const hasContent = matchScore > 0 || (Array.isArray(parsed.missingKeywords) && parsed.missingKeywords.length) || (parsed.suggestions && parsed.suggestions.length > 10);
  if (!hasContent) return null;
  return {
    matchScore,
    missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
    suggestions: parsed.suggestions || '',
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    starSuggestions: Array.isArray(parsed.starSuggestions) ? parsed.starSuggestions : [],
  };
}

/** Run analysis (Gemini → keyword fallback). Returns { result, mode }. No persistence. */
async function analyzeResume(resumeText, jobDescription) {
  if (!resumeText || !jobDescription) {
    const e = new Error('Resume text and job description are required'); e.statusCode = 400; throw e;
  }
  if (resumeText.length > MAX_INPUT || jobDescription.length > MAX_INPUT) {
    const e = new Error(`Resume and job description must each be under ${MAX_INPUT} characters`); e.statusCode = 400; throw e;
  }
  let result = null;
  let mode = 'keyword';
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try { result = await geminiAnalysis(resumeText, jobDescription); if (result) mode = 'ai'; }
    catch (e) { console.warn('Gemini analysis failed, keyword fallback:', e.message); }
  }
  if (!result) result = keywordAnalysis(resumeText, jobDescription);
  return { result, mode };
}

// Coerce arbitrary LLM JSON into the ResumeDraft sub-schemas (defensive).
const str = (v) => (v == null ? '' : String(v));
function shapeDraft(parsed) {
  const pi = parsed.personalInfo || {};
  return {
    personalInfo: {
      fullName: str(pi.fullName), email: str(pi.email), phone: str(pi.phone), location: str(pi.location),
      linkedin: str(pi.linkedin), github: str(pi.github), portfolio: str(pi.portfolio), summary: str(pi.summary),
    },
    education: Array.isArray(parsed.education) ? parsed.education.slice(0, 10).map((e) => ({
      institution: str(e.institution), degree: str(e.degree), field: str(e.field),
      startDate: str(e.startDate), endDate: str(e.endDate), gpa: str(e.gpa),
    })) : [],
    experience: Array.isArray(parsed.experience) ? parsed.experience.slice(0, 15).map((e) => ({
      company: str(e.company), position: str(e.position), startDate: str(e.startDate),
      endDate: str(e.endDate), current: !!e.current, description: str(e.description),
    })) : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 50).map(str) : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 15).map((p) => ({
      name: str(p.name), description: str(p.description), technologies: str(p.technologies), link: str(p.link),
    })) : [],
  };
}

// The top-level sections we diff for `changedSections` — exactly the keys
// shapeDraft covers, so partial coverage can't produce false positives.
const DIFFABLE_SECTIONS = ['personalInfo', 'education', 'experience', 'skills', 'projects'];

/**
 * Deep-stable JSON stringify of one section for diffing. We just rely on
 * Mongoose `toObject()` / shapeDraft output being plain JSON; key order is
 * deterministic across both runs because both come from the same shape.
 */
function _jsonOf(value) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

/**
 * Compute which top-level sections changed between two shaped drafts.
 * Deep-compares via JSON.stringify per section (both inputs run through
 * shapeDraft so key order is stable).
 */
function _diffSections(before, after) {
  const changed = [];
  for (const key of DIFFABLE_SECTIONS) {
    if (_jsonOf(before?.[key]) !== _jsonOf(after?.[key])) changed.push(key);
  }
  return changed;
}

/**
 * Refine an existing ResumeDraft with a natural-language instruction.
 * Loads the draft (ownership-checked by userId), asks the LLM to return the
 * FULL updated draft as JSON only, validates shape via shapeDraft, persists,
 * and returns { draft, changedSections } where changedSections is computed
 * server-side by diffing the shaped before/after.
 *
 * Throws an Error with `.statusCode`:
 *   400  bad input (missing instruction, length out of range)
 *   404  draft not found / not owned by userId
 *   422  LLM output could not be parsed or failed shape validation
 *   503  LLM not configured
 */
async function refineDraft({ userId, draftId, instruction }) {
  if (!instruction || typeof instruction !== 'string') {
    const e = new Error('Instruction is required'); e.statusCode = 400; throw e;
  }
  const trimmed = instruction.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    const e = new Error('Instruction must be between 1 and 500 characters'); e.statusCode = 400; throw e;
  }
  if (!config.hasLLM()) {
    const e = new Error('Resume refinement needs an AI model, which is not configured on this server.');
    e.statusCode = 503; throw e;
  }

  const draft = await ResumeDraft.findOne({ _id: draftId, user: userId });
  if (!draft) {
    const e = new Error('Draft not found'); e.statusCode = 404; throw e;
  }

  // Snapshot the BEFORE in the same shape we'll compare AFTER against.
  const beforeShape = shapeDraft({
    personalInfo: draft.personalInfo,
    education: draft.education,
    experience: draft.experience,
    skills: draft.skills,
    projects: draft.projects,
  });

  const draftJson = JSON.stringify(beforeShape);

  let message;
  try {
    message = await llm.chat({
      model: llm.GEN_MODEL(),
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: 'You are an expert resume editor. The user will give you a structured resume draft (JSON) and a natural-language instruction. Apply the instruction by rephrasing, reordering, or re-emphasizing existing content ONLY. NEVER invent employers, degrees, dates, companies, projects, schools, or metrics that are not already present in the draft. Return the FULL updated draft as a single JSON object with EXACTLY these top-level keys: personalInfo {fullName,email,phone,location,linkedin,github,portfolio,summary}, education [{institution,degree,field,startDate,endDate,gpa}], experience [{company,position,startDate,endDate,current,description}], skills [string], projects [{name,description,technologies,link}]. Return ONLY the JSON object — no markdown, no commentary, no code fences.' },
        { role: 'user', content: `CURRENT DRAFT (JSON):\n${draftJson}\n\nINSTRUCTION:\n${trimmed}` },
      ],
    });
  } catch (llmErr) {
    const e = new Error(`LLM refinement failed: ${llmErr.message}`); e.statusCode = 502; throw e;
  }

  let parsed;
  try {
    const raw = (message.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    const e = new Error('The refinement could not be parsed cleanly. Draft left unchanged.');
    e.statusCode = 422; throw e;
  }

  // Validate top-level shape: must be an object with at LEAST the keys we diff.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const e = new Error('Refinement returned the wrong shape. Draft left unchanged.');
    e.statusCode = 422; throw e;
  }
  for (const key of DIFFABLE_SECTIONS) {
    if (!(key in parsed)) {
      const e = new Error(`Refinement missing required section "${key}". Draft left unchanged.`);
      e.statusCode = 422; throw e;
    }
  }

  // Coerce through the same shaper used for create. This is the contract check.
  const afterShape = shapeDraft(parsed);

  // Guardrail: refusing to invent → if the model added new employers or new
  // education entries, that's a hallucination, not a refinement. Bullet count
  // staying the same but content changing is fine.
  if (afterShape.experience.length > beforeShape.experience.length
      || afterShape.education.length > beforeShape.education.length
      || afterShape.projects.length > beforeShape.projects.length) {
    const e = new Error('Refinement tried to add new entries. Draft left unchanged.');
    e.statusCode = 422; throw e;
  }

  const changedSections = _diffSections(beforeShape, afterShape);

  // P7: snapshot the BEFORE state so this AI edit is one-click undoable.
  snapshotRevision(draft, `Before refine: ${trimmed.slice(0, 40)}`);

  // Persist. We only touch the diffable sections — other fields (name,
  // template, jobDescription, coverLetter, certifications) are left alone.
  draft.personalInfo = afterShape.personalInfo;
  draft.education = afterShape.education;
  draft.experience = afterShape.experience;
  draft.skills = afterShape.skills;
  draft.projects = afterShape.projects;
  draft.lastGenerated = new Date();
  await draft.save();

  return { draft, changedSections };
}

// ───────────────────────── P7 resume canvas ─────────────────────────

const MAX_REVISIONS = 20;
const PI_FIELDS = ['fullName', 'email', 'phone', 'location', 'linkedin', 'github', 'portfolio', 'summary'];
const EXP_FIELDS = ['company', 'position', 'startDate', 'endDate', 'current', 'description'];
const EDU_FIELDS = ['institution', 'degree', 'field', 'startDate', 'endDate', 'gpa'];
const PROJ_FIELDS = ['name', 'description', 'technologies', 'link'];

// Flatten a draft's content to plain text for ATS / keyword analysis.
function draftToText(draft) {
  const p = draft.personalInfo || {};
  const lines = [];
  if (p.fullName) lines.push(p.fullName);
  [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio].filter(Boolean).forEach((x) => lines.push(x));
  if (p.summary) lines.push(p.summary);
  if (Array.isArray(draft.skills) && draft.skills.length) lines.push(`Skills: ${draft.skills.join(', ')}`);
  (draft.experience || []).forEach((e) => {
    if (!e) return;
    const head = [e.position, e.company].filter(Boolean).join(' at ');
    if (head) lines.push(head);
    if (e.description) lines.push(e.description);
  });
  (draft.education || []).forEach((e) => {
    if (!e) return;
    const head = [e.degree, e.field, e.institution].filter(Boolean).join(', ');
    if (head) lines.push(head);
  });
  (draft.projects || []).forEach((pr) => {
    if (!pr) return;
    if (pr.name) lines.push(pr.name);
    if (pr.description) lines.push(pr.description);
    if (pr.technologies) lines.push(`Technologies: ${pr.technologies}`);
  });
  return lines.filter(Boolean).join('\n');
}

// Parse LLM draft JSON (fence-strip). Throws 422 (keep prior state) on failure.
function parseDraftJSON(message, label) {
  try {
    const raw = (message.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    const e = new Error(`The ${label} could not be parsed cleanly. Draft left unchanged.`); e.statusCode = 422; throw e;
  }
}

// Guard: an AI edit may not ADD employers/degrees/projects — that's invention.
function assertNoInvention(beforeShape, afterShape) {
  if (afterShape.experience.length > beforeShape.experience.length
      || afterShape.education.length > beforeShape.education.length
      || afterShape.projects.length > beforeShape.projects.length) {
    const e = new Error('The edit tried to add new entries. Draft left unchanged.'); e.statusCode = 422; throw e;
  }
}

// Push a snapshot of the draft's current diffable sections onto revisions, cap 20.
function snapshotRevision(draft, label) {
  const snapshot = shapeDraft({
    personalInfo: draft.personalInfo, education: draft.education,
    experience: draft.experience, skills: draft.skills, projects: draft.projects,
  });
  draft.revisions.push({ at: new Date(), label: (label || 'edit').slice(0, 80), snapshot });
  if (draft.revisions.length > MAX_REVISIONS) {
    draft.revisions = draft.revisions.slice(draft.revisions.length - MAX_REVISIONS);
  }
}

/**
 * Click-to-edit: apply a single field edit identified by a whitelisted path.
 * Paths: `personalInfo.<field>`, `skills` (value = array | comma string),
 *        `experience.<i>.<field>`, `education.<i>.<field>`, `projects.<i>.<field>`.
 * No revision snapshot (manual edits are continuous; only AI edits snapshot).
 */
async function applySectionEdit({ userId, draftId, path, value }) {
  if (!path || typeof path !== 'string') { const e = new Error('A field path is required'); e.statusCode = 400; throw e; }
  const draft = await ResumeDraft.findOne({ _id: draftId, user: userId });
  if (!draft) { const e = new Error('Draft not found'); e.statusCode = 404; throw e; }

  const parts = path.split('.');
  const root = parts[0];
  const cap = (s) => String(s == null ? '' : s).slice(0, 2000);

  if (root === 'personalInfo' && parts.length === 2 && PI_FIELDS.includes(parts[1])) {
    if (!draft.personalInfo) draft.personalInfo = {};
    draft.personalInfo[parts[1]] = cap(value);
    draft.markModified('personalInfo');
  } else if (root === 'skills' && parts.length === 1) {
    const arr = Array.isArray(value) ? value : String(value || '').split(',');
    draft.skills = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  } else if ((root === 'experience' || root === 'education' || root === 'projects') && parts.length === 3) {
    const idx = Number(parts[1]);
    const field = parts[2];
    const fields = root === 'experience' ? EXP_FIELDS : root === 'education' ? EDU_FIELDS : PROJ_FIELDS;
    if (!Number.isInteger(idx) || idx < 0 || idx >= (draft[root] || []).length || !fields.includes(field)) {
      const e = new Error('Invalid field path'); e.statusCode = 400; throw e;
    }
    draft[root][idx][field] = field === 'current' ? !!value : cap(value);
    draft.markModified(root);
  } else {
    const e = new Error('Unsupported field path'); e.statusCode = 400; throw e;
  }
  await draft.save();
  return draft;
}

/**
 * JD tailoring: fork the draft into a linked variant whose EXISTING content is
 * reordered/rephrased toward the job description. Skills the JD wants but the
 * resume lacks are returned as `gaps[]` (suggestions) — NEVER inserted (the
 * hallucination guard). Gaps + ATS score come from the deterministic analysis,
 * not the LLM. Emits a best-effort `resume` signal. Returns { draft, gaps }.
 */
async function tailorDraft({ userId, draftId, jobDescription, company, role }) {
  if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
    const e = new Error('A job description is required to tailor.'); e.statusCode = 400; throw e;
  }
  const jd = jobDescription.trim().slice(0, MAX_INPUT);
  if (!config.hasLLM()) {
    const e = new Error('Resume tailoring needs an AI model, which is not configured on this server.'); e.statusCode = 503; throw e;
  }
  const parent = await ResumeDraft.findOne({ _id: draftId, user: userId });
  if (!parent) { const e = new Error('Draft not found'); e.statusCode = 404; throw e; }

  const beforeShape = shapeDraft({
    personalInfo: parent.personalInfo, education: parent.education,
    experience: parent.experience, skills: parent.skills, projects: parent.projects,
  });

  let message;
  try {
    message = await llm.chat({
      model: llm.GEN_MODEL(),
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: 'You are an expert resume editor tailoring a resume to a target job. Reorder, rephrase, and re-emphasize the EXISTING content so the most JD-relevant experience and skills come first, mirroring the JD\'s wording where it is truthful. NEVER invent employers, degrees, schools, dates, projects, or skills that are not already present. If the JD requires skills the resume lacks, DO NOT add them — leave them out. Return ONLY a JSON object with EXACTLY these top-level keys: personalInfo {fullName,email,phone,location,linkedin,github,portfolio,summary}, education [{institution,degree,field,startDate,endDate,gpa}], experience [{company,position,startDate,endDate,current,description}], skills [string], projects [{name,description,technologies,link}]. No markdown, no commentary, no code fences.' },
        { role: 'user', content: `CURRENT RESUME (JSON):\n${JSON.stringify(beforeShape)}\n\nTARGET JOB DESCRIPTION:\n${jd}` },
      ],
    });
  } catch (llmErr) { const e = new Error(`LLM tailoring failed: ${llmErr.message}`); e.statusCode = 502; throw e; }

  const parsed = parseDraftJSON(message, 'tailored resume');
  for (const key of DIFFABLE_SECTIONS) {
    if (!(key in parsed)) { const e = new Error(`Tailored resume missing section "${key}". Draft left unchanged.`); e.statusCode = 422; throw e; }
  }
  const afterShape = shapeDraft(parsed);
  assertNoInvention(beforeShape, afterShape);

  // Deterministic gaps + ATS score from the keyword/Gemini analysis of the
  // tailored content vs the JD. Best-effort — tailoring still yields a variant.
  let gaps = [];
  let atsScore = null;
  try {
    const { result } = await analyzeResume(draftToText({ ...afterShape }), jd);
    gaps = Array.isArray(result.missingKeywords) ? result.missingKeywords.slice(0, 20) : [];
    atsScore = Number(result.matchScore);
  } catch { /* analysis is best-effort */ }

  const variantName = (company || role)
    ? `Tailored — ${[role, company].filter(Boolean).join(' @ ')}`
    : `Tailored — ${parent.name}`;
  const variant = await ResumeDraft.create({
    user: userId,
    name: variantName.slice(0, 100),
    template: parent.template,
    // Carry the parent's visual design so a tailored variant keeps the same look
    // (without this the fork falls back to the schema-default/legacy design).
    design: parent.design,
    parentDraft: parent._id,
    targetCompany: String(company || '').slice(0, 100),
    targetRole: String(role || '').slice(0, 100),
    jobDescription: jd,
    gaps,
    atsScore: Number.isFinite(atsScore) ? atsScore : null,
    atsCheckedAt: Number.isFinite(atsScore) ? new Date() : null,
    lastGenerated: new Date(),
    // Seed the variant's history with the parent's pre-tailor content.
    revisions: [{ at: new Date(), label: `Forked from "${parent.name}"`.slice(0, 80), snapshot: beforeShape }],
    ...afterShape,
  });

  if (Number.isFinite(atsScore)) {
    await emitSignals(userId, [{
      pillar: 'resume', skill: 'jd_tailor', score: atsScore / 100,
      source: 'resume_analysis', sourceId: variant._id,
    }]);
  }
  return { draft: variant, gaps };
}

/**
 * On-demand ATS check of a draft against its stored job description. Caches the
 * score + gaps on the draft and emits a best-effort `resume` signal.
 * Returns { draft, mode, analysis }.
 */
async function atsCheckDraft({ userId, draftId }) {
  const draft = await ResumeDraft.findOne({ _id: draftId, user: userId });
  if (!draft) { const e = new Error('Draft not found'); e.statusCode = 404; throw e; }
  const jd = (draft.jobDescription || '').trim();
  if (!jd) {
    const e = new Error('Add a target job description first (tailor to a JD or set one) so the resume can be scored.'); e.statusCode = 400; throw e;
  }
  const { result, mode } = await analyzeResume(draftToText(draft), jd);
  draft.atsScore = Number(result.matchScore) || 0;
  draft.atsCheckedAt = new Date();
  draft.gaps = Array.isArray(result.missingKeywords) ? result.missingKeywords.slice(0, 20) : [];
  await draft.save();
  await emitSignals(userId, [{
    pillar: 'resume', skill: 'ats_match', score: draft.atsScore / 100,
    source: 'resume_analysis', sourceId: draft._id,
  }]);
  return { draft, mode, analysis: result };
}

/** Restore a draft to a saved revision. Snapshots current state first (undoable). */
async function restoreRevision({ userId, draftId, revisionId }) {
  const draft = await ResumeDraft.findOne({ _id: draftId, user: userId });
  if (!draft) { const e = new Error('Draft not found'); e.statusCode = 404; throw e; }
  const rev = draft.revisions.id(revisionId);
  if (!rev) { const e = new Error('Revision not found'); e.statusCode = 404; throw e; }
  snapshotRevision(draft, 'Before restore');
  const shaped = shapeDraft(rev.snapshot || {});
  draft.personalInfo = shaped.personalInfo;
  draft.education = shaped.education;
  draft.experience = shaped.experience;
  draft.skills = shaped.skills;
  draft.projects = shaped.projects;
  draft.lastGenerated = new Date();
  await draft.save();
  return draft;
}

/**
 * Generate a resume draft from the user's profile (and optional job description).
 * Persists a new ResumeDraft and returns it. Requires an LLM.
 * Throws an Error with `.statusCode` for caller mapping.
 */
async function generateDraftFromProfile({ userId, profile, jobDescription }) {
  if (!config.hasLLM()) {
    const e = new Error('Resume generation needs an AI model, which is not configured on this server.');
    e.statusCode = 503; throw e;
  }
  const profileText = JSON.stringify(profile || {}, null, 2);
  const jd = (jobDescription || '').slice(0, MAX_INPUT);

  const message = await llm.chat({
    model: llm.GEN_MODEL(),
    temperature: 0.4,
    max_tokens: 2500,
    messages: [
      { role: 'system', content: 'You are an expert resume writer. Build a recruiter-ready resume from the candidate profile provided. If a job description is given, tailor wording to it. NEVER invent employers, degrees, schools, dates, or metrics that are not supported by the profile — if a field is missing, leave it as an empty string or use only what the profile provides. Return ONLY a JSON object (no markdown, no commentary) with EXACTLY these top-level keys: personalInfo {fullName,email,phone,location,linkedin,github,portfolio,summary}, education [{institution,degree,field,startDate,endDate,gpa}], experience [{company,position,startDate,endDate,current,description}], skills [string], projects [{name,description,technologies,link}].' },
      { role: 'user', content: `CANDIDATE PROFILE:\n${profileText}\n\nTARGET JOB DESCRIPTION:\n${jd || '(none provided — write for a general software engineer role)'}` },
    ],
  });

  let parsed;
  try {
    const raw = (message.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    const e = new Error('The generated draft could not be parsed cleanly. Please try again.');
    e.statusCode = 502; throw e;
  }

  const shaped = shapeDraft(parsed);
  return ResumeDraft.create({
    user: userId,
    name: `AI Resume — ${new Date().toLocaleDateString()}`,
    jobDescription: jd || undefined,
    lastGenerated: new Date(),
    ...shaped,
  });
}

/**
 * Rewrite a resume to target a job description and save it as a new ResumeDraft.
 * Confirm-gate executor. Requires an LLM.
 * @returns {Promise<object>} the created ResumeDraft
 */
async function rewriteResume({ userId, resumeText, jobDescription }) {
  if (!resumeText || !jobDescription) {
    const e = new Error('Resume text and a job description are required'); e.statusCode = 400; throw e;
  }
  if (resumeText.length > MAX_INPUT || jobDescription.length > MAX_INPUT) {
    const e = new Error(`Resume and job description must each be under ${MAX_INPUT} characters`); e.statusCode = 400; throw e;
  }
  if (!config.hasLLM()) {
    const e = new Error('Resume rewriting needs an AI model, which is not configured on this server.'); e.statusCode = 503; throw e;
  }

  const message = await llm.chat({
    model: llm.GEN_MODEL(),
    temperature: 0.4,
    max_tokens: 2500,
    messages: [
      { role: 'system', content: 'You are an expert resume writer. Rewrite the candidate\'s resume to target the given job description: tailor wording to the JD, strengthen bullet points (action verb + impact + metric where the data exists), and surface relevant skills. Do NOT invent employers, degrees, dates, or metrics that are not supported by the original resume. Return ONLY a valid JSON object (no markdown) with keys: personalInfo {fullName,email,phone,location,linkedin,github,portfolio,summary}, education [{institution,degree,field,startDate,endDate,gpa}], experience [{company,position,startDate,endDate,current,description}], skills [string], projects [{name,description,technologies,link}].' },
      { role: 'user', content: `ORIGINAL RESUME:\n${resumeText}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}` },
    ],
  });

  let parsed;
  try {
    const raw = (message.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    const e = new Error('The rewrite could not be generated cleanly. Please try again.'); e.statusCode = 502; throw e;
  }

  const shaped = shapeDraft(parsed);
  return ResumeDraft.create({
    user: userId,
    name: `Tailored Resume — ${new Date().toLocaleDateString()}`,
    jobDescription,
    lastGenerated: new Date(),
    ...shaped,
  });
}

module.exports = {
  analyzeResume, rewriteResume, refineDraft, generateDraftFromProfile,
  // P7 resume canvas
  applySectionEdit, tailorDraft, atsCheckDraft, restoreRevision,
  // Generative Resume Studio — shaping reused by the intake copilot
  shapeDraft,
};
