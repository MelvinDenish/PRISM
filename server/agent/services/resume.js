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

module.exports = { analyzeResume, rewriteResume, refineDraft, generateDraftFromProfile };
