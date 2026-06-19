const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const llm = require('../agent/llm');
const { config } = require('../config/env');
const ResumeDraft = require('../models/ResumeDraft');
const User = require('../models/User');
const {
  refineDraft, generateDraftFromProfile,
  applySectionEdit, tailorDraft, atsCheckDraft, restoreRevision,
} = require('../agent/services/resume');
const { generateDocument } = require('../agent/services/document');
const { LAYOUTS, FONT_PAIRS, DENSITIES, HEADING_STYLES, SECTION_KEYS, SEED_KEYS } = require('../agent/services/resumeDesign');
const { exportResumePdfArtifact } = require('../agent/services/resumePdf');
const { intakeTurn } = require('../agent/services/resumeIntake');
const { shapeAuthorContent, authorHtml, summaryFromContent, expandProjectContent } = require('../agent/services/resumeAuthor');
const { assessCompleteness, seedCollectedFromProfile, mergeCollected, estimateContentWords, MIN_CONTENT_WORDS } = require('../agent/services/resumeCompleteness');
const { cuicFileName, cuicChecklist, CUIC_SECTIONS } = require('../utils/cuicResume');
const router = express.Router();

// Content completion for resume/cover-letter text: routes the configured resume CONTENT
// model + provider (RESUME_LLM_* — OpenRouter by default now) and returns an OpenAI-shaped
// completion so existing `.choices[0].message.content` reads are unchanged.
const contentCompletion = async (params = {}) => {
  const { model, ...rest } = params;
  const message = await llm.chat({
    baseUrl: config.resumeLlmBaseUrl(),
    apiKey: config.resumeLlmApiKey(),
    model: model || config.resumeContentModel(),
    ...rest,
  });
  return { choices: [{ message }] };
};

// CUIC compliance catalog — the required sections the client checklist renders.
router.get('/cuic-checklist', protect, (req, res) => {
  res.json({ success: true, sections: CUIC_SECTIONS });
});

// Public design-system catalog for the client's design panel (display lists only;
// buildPalette/validateDesign logic stays server-side and is never shipped).
router.get('/design-system', protect, (req, res) => {
  res.json({
    success: true,
    designSystem: {
      layouts: LAYOUTS,
      fontPairs: FONT_PAIRS,
      densities: DENSITIES,
      headingStyles: HEADING_STYLES,
      sectionKeys: SECTION_KEYS,
      paletteVibes: SEED_KEYS,
    },
  });
});

// Shared profile snapshot for the resume pipeline — includes CUIC academics
// (cgpa / 10th / 12th / register number / department) so the AI-authored resume
// always carries them. Never selects password/internal flags.
async function loadResumeProfile(userId) {
  const user = await User.findById(userId)
    .select('name email bio skills expertise aimingCompany currentCompany experienceLevel experience college graduationYear linkedin github registerNumber department cgpa tenthPercent twelfthPercent')
    .lean();
  return {
    name: user?.name || '', email: user?.email || '', bio: user?.bio || '', skills: user?.skills || [],
    expertise: user?.expertise || [], aimingCompany: user?.aimingCompany || '', currentCompany: user?.currentCompany || '',
    experienceLevel: user?.experienceLevel || '', yearsOfExperience: user?.experience || 0,
    college: user?.college || '', graduationYear: user?.graduationYear || '', linkedin: user?.linkedin || '', github: user?.github || '',
    registerNumber: user?.registerNumber || '', department: user?.department || '',
    cgpa: user?.cgpa != null ? String(user.cgpa) : '', tenthPercent: user?.tenthPercent != null ? String(user.tenthPercent) : '', twelfthPercent: user?.twelfthPercent != null ? String(user.twelfthPercent) : '',
  };
}

// Rebuild the intake `collected` shape from a saved ResumeDraft so a NEW resume can
// start pre-filled with a previous resume's details (reuse old info). Only maps the
// content fields the pipeline knows; mirrors the re-shape in /regenerate (below).
function reconstructCollected(draftDoc) {
  const d = (draftDoc && typeof draftDoc.toObject === 'function') ? draftDoc.toObject() : (draftDoc || {});
  const pi = d.personalInfo || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    personalInfo: {
      fullName: pi.fullName || '', email: pi.email || '', phone: pi.phone || '',
      location: pi.location || '', linkedin: pi.linkedin || '', github: pi.github || '',
      portfolio: pi.portfolio || '', summary: pi.summary || '',
    },
    education: arr(d.education).map((e) => ({ institution: e.institution || '', degree: e.degree || '', field: e.field || '', startDate: e.startDate || '', endDate: e.endDate || '', gpa: e.gpa || '' })),
    experience: arr(d.experience).map((e) => ({ company: e.company || '', position: e.position || '', startDate: e.startDate || '', endDate: e.endDate || '', current: !!e.current, description: e.description || '' })),
    projects: arr(d.projects).map((p) => ({ name: p.name || '', description: p.description || '', technologies: p.technologies || '', link: p.link || '' })),
    skills: arr(d.skills).map(String),
    certifications: arr(d.certifications).map((c) => ({ name: c.name || '', issuer: c.issuer || '', date: c.date || '' })),
    achievements: arr(d.achievements).map(String),
    positionsOfResponsibility: arr(d.positionsOfResponsibility).map(String),
    languages: arr(d.languages).map(String),
    hobbies: arr(d.hobbies).map(String),
    cgpa: d.cgpa || '', tenthPercent: d.tenthPercent || '', twelfthPercent: d.twelfthPercent || '',
    registerNumber: d.registerNumber || '',
  };
}

// Build a draft name + the persisted ResumeDraft fields from shaped content + html.
function authoredDraftDoc(userId, shaped, html, meta) {
  return {
    user: userId,
    name: `AI Resume — ${new Date().toLocaleDateString()}`,
    personalInfo: shaped.personalInfo,
    education: shaped.education,
    experience: shaped.experience,
    skills: shaped.skills,
    projects: shaped.projects,
    certifications: shaped.certifications,
    achievements: shaped.achievements,
    positionsOfResponsibility: shaped.positionsOfResponsibility,
    hobbies: shaped.hobbies,
    languages: shaped.languages,
    cgpa: shaped.cgpa, tenthPercent: shaped.tenthPercent, twelfthPercent: shaped.twelfthPercent,
    generatedHtml: html,
    generationMeta: meta,
    lastGenerated: new Date(),
  };
}

// Run the (slow) agentic design loop in the BACKGROUND and write the result back to the
// draft, flipping generationStatus done/failed. Process-local + best-effort (matches the
// app's other in-memory background work); the client polls the draft until it leaves
// 'generating'. Never throws to the caller and never leaves an unhandled rejection.
function runAuthorInBackground(draftId, content, instruction) {
  (async () => {
    try {
      const { html, meta } = await authorHtml({ content, instruction });
      await ResumeDraft.findByIdAndUpdate(draftId, {
        generatedHtml: html, generationMeta: meta, lastGenerated: new Date(),
        generationStatus: 'done', generationError: '',
      });
    } catch (err) {
      const msg = err.statusCode === 429
        ? 'The AI is busy right now (rate limited). Please try again in a moment.'
        : (err.message || 'Resume generation failed.');
      await ResumeDraft.findByIdAndUpdate(draftId, { generationStatus: 'failed', generationError: msg }).catch(() => {});
    }
  })();
}

// STAGE 0 — GAP-AWARE INTAKE with a DETERMINISTIC completeness gate. Seeds from
// the profile, asks only for what's missing, and re-scores each turn. The client
// holds `collected` and echoes it back; `ready` mirrors the server-side gate.
// Body: { messages: [{role,content}], collected? }
//   →  { success, reply, collected, assessment: { have, missing, gateMet, contentScore }, ready }
router.post('/intake', protect, aiLimiter, async (req, res) => {
  try {
    const { messages, collected, fromDraftId } = req.body || {};
    const profile = await loadResumeProfile(req.user._id);
    // On the OPENING turn (no running `collected` yet) seed from a previous resume so the
    // user can reuse old details: the chosen draft (fromDraftId) or, failing that, their
    // most recently updated one. Once the client echoes `collected` back, this is ignored.
    let seed;
    if (!collected) {
      try {
        const prior = fromDraftId
          ? await ResumeDraft.findOne({ _id: fromDraftId, user: req.user._id })
          : await ResumeDraft.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
        if (prior) seed = reconstructCollected(prior);
      } catch { /* bad id / lookup failure — just start without a prior seed */ }
    }
    const result = await intakeTurn({ messages, collected, profile, seed });
    return res.json({ success: true, ...result });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message });
  }
});

// DRAFT-CONTENT — the "fill a page for me" assist. The deterministic gate keeps a
// word-count item ("enough detail to fill a page") that the user shouldn't have to
// TYPE past; this lets the AI draft fuller project descriptions (grounded in what
// they already gave) which the user then edits and accepts. Two modes:
//   • draft  (body { collected }):                 LLM expands project briefs → { draftedProjects }
//   • apply  (body { collected, apply:true, projects }): deterministically merge the
//     user's EDITED projects back through mergeCollected → assessCompleteness, so the
//     checklist/button/gate stay consistent with the rest of the intake.
router.post('/draft-content', protect, aiLimiter, async (req, res) => {
  try {
    const { collected, apply, projects } = req.body || {};
    const profile = await loadResumeProfile(req.user._id);
    const base = (collected && typeof collected === 'object') ? collected : seedCollectedFromProfile(profile);

    if (apply) {
      // Accept path: fold the user's edited project descriptions in and re-score.
      const edited = Array.isArray(projects) ? projects : [];
      const merged = mergeCollected(base, { projects: edited });
      const assessment = assessCompleteness(merged, profile);
      return res.json({ success: true, collected: merged, assessment });
    }

    // Draft path: expand the briefs (no merge yet — the user edits first).
    const draftedProjects = await expandProjectContent(base);
    return res.json({ success: true, draftedProjects });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message });
  }
});

// AUTHOR — the AI-authored resume pipeline (Stages A→C). The content comes from the
// gated /intake chat (body { collected }); a legacy empty body seeds from the profile,
// which then fails the gate below (no projects) and is rejected. Optional { instruction }
// steers the design. The completeness gate is enforced HERE — the real wall, not just
// the disabled client button. Persists + returns the draft.
router.post('/author', protect, aiLimiter, async (req, res) => {
  try {
    const { collected, instruction } = req.body || {};
    const profile = await loadResumeProfile(req.user._id);
    const rawContent = (collected && typeof collected === 'object') ? collected : seedCollectedFromProfile(profile);

    // GATE: refuse to generate a weak resume. The client disables its button on the
    // same signal, but this is the enforcement — a direct call can't bypass it.
    const assessment = assessCompleteness(rawContent, profile);
    if (!assessment.gateMet) {
      return res.status(422).json({
        success: false,
        message: "Let's finish a few details first so your resume is strong enough.",
        assessment,
      });
    }

    const shaped = shapeAuthorContent(rawContent, profile);
    // Grounded summary fallback: if the chat never captured a summary, write one from
    // the collected content (best-effort — never blocks generation).
    if (!shaped.personalInfo.summary) {
      shaped.personalInfo.summary = await summaryFromContent(shaped);
    }
    // Front-load truthful content so the design loop usually fills the A4 in one pass.
    // `enoughContent` is advisory (the gate lets a user generate with thin content — see
    // resumeCompleteness's comment on not trapping them). When they do, elaborate the
    // EXISTING project briefs into fuller descriptions: expandProjectContent never invents
    // new projects/employers/dates/metrics, it only deepens what's already there. The gate
    // guarantees ≥2 valid projects, so this won't throw; still best-effort (the measured
    // fill loop in authorHtml is the real guarantee if a thin brief can't be expanded).
    const wc = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
    const hasThinProject = (shaped.projects || []).some((p) => wc(p.description) < 25);
    if (estimateContentWords(shaped) < MIN_CONTENT_WORDS && hasThinProject) {
      try {
        const fuller = await expandProjectContent(shaped);
        const byName = new Map((fuller || []).map((p) => [String(p.name || '').toLowerCase(), p]));
        // Only deepen THIN descriptions — never clobber a project the user already wrote out
        // fully (e.g. edited the "Draft my project details" assist by hand and accepted it).
        shaped.projects = (shaped.projects || []).map((p) => {
          if (wc(p.description) >= 25) return p;
          const d = byName.get(String(p.name || '').toLowerCase());
          return d ? { ...p, description: d.description || p.description, technologies: d.technologies || p.technologies } : p;
        });
      } catch { /* a genuinely thin brief may not expand — the fill loop still handles it */ }
    }
    // Create the draft immediately in 'generating' state and author the HTML in the
    // background (the agentic loop can run several rounds); the client polls the draft.
    const draft = await ResumeDraft.create({ ...authoredDraftDoc(req.user._id, shaped, '', undefined), generationStatus: 'generating' });
    runAuthorInBackground(draft._id, shaped, instruction);
    return res.status(202).json({ success: true, draft });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message });
  }
});

// REGENERATE — re-author the HTML for an existing draft (same content, brand-new
// design). Optional { instruction } steers the look ("two-column, blue accent").
router.post('/drafts/:id/regenerate', protect, aiLimiter, async (req, res) => {
  try {
    const { instruction } = req.body || {};
    const draft = await ResumeDraft.findOne({ _id: req.params.id, user: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    const profile = await loadResumeProfile(req.user._id);
    // Re-shape from the draft's own stored content (no new facts invented).
    const shaped = shapeAuthorContent({
      personalInfo: draft.personalInfo, education: draft.education, experience: draft.experience,
      skills: draft.skills, projects: draft.projects, certifications: draft.certifications,
      achievements: draft.achievements, positionsOfResponsibility: draft.positionsOfResponsibility,
      hobbies: draft.hobbies, languages: draft.languages,
      cgpa: draft.cgpa, tenthPercent: draft.tenthPercent, twelfthPercent: draft.twelfthPercent,
    }, profile);
    // Re-author in the background (same content, brand-new design); client polls.
    draft.generationStatus = 'generating';
    draft.generationError = '';
    await draft.save();
    runAuthorInBackground(draft._id, shaped, instruction);
    return res.status(202).json({ success: true, draft });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message });
  }
});

// GET user's drafts
router.get('/drafts', protect, async (req, res) => {
  try {
    const drafts = await ResumeDraft.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, drafts });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GET single draft
router.get('/drafts/:id', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.findOne({ _id: req.params.id, user: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, draft });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// SAVE draft
router.post('/drafts', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, draft });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// UPDATE draft
router.put('/drafts/:id', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    res.json({ success: true, draft });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// DELETE draft
router.delete('/drafts/:id', protect, async (req, res) => {
  try {
    await ResumeDraft.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Draft deleted' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GENERATE resume content with AI — FIXED: structured response, no raw JSON leak
router.post('/generate', protect, aiLimiter, async (req, res) => {
  try {
    const { personalInfo, education, experience, skills, projects, jobDescription } = req.body;
    if (!process.env.GROQ_API_KEY) return res.status(400).json({ success: false, message: 'AI generation requires GROQ_API_KEY' });

    const userProfile = JSON.stringify({ personalInfo, education, experience, skills, projects }, null, 2);

    const completion = await contentCompletion({
      messages: [
        { role: 'system', content: `You are an expert ATS resume writer. Given user info and a job description, return a JSON object with EXACTLY this structure. Do NOT add any text before or after the JSON:
{
  "summary": "A 2-3 sentence professional summary paragraph (plain text, no bullet points)",
  "experienceDescriptions": [
    {
      "company": "company name",
      "position": "job title",
      "description": "2-3 sentence improved description led by a strong action verb; include a quantifiable achievement ONLY if present in the input (never invent numbers)"
    }
  ],
  "skillsOptimized": ["Skill1", "Skill2", "Skill3"],
  "additionalSuggestions": "1-2 sentence suggestion"
}

CRITICAL RULES:
- "summary" must be a plain text paragraph, NOT a JSON dump
- "skillsOptimized" must be an array of SHORT individual skill names like ["Java", "Python", "React", "System Design"], NOT long phrases
- Return ONLY valid JSON, nothing else` },
        { role: 'user', content: `User profile:\n${userProfile}\n\nJob Description:\n${jobDescription || 'General software engineer role'}` }
      ],
      max_tokens: 1000,
      temperature: 0.5
    });

    let result;
    const raw = completion.choices[0]?.message?.content || '{}';

    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      // Fallback: extract fields manually from the text
      result = {
        summary: raw.length < 500 ? raw : raw.substring(0, 500),
        experienceDescriptions: [],
        skillsOptimized: skills || [],
        additionalSuggestions: ''
      };
    }

    // Sanitize: ensure summary is not a JSON string
    if (typeof result.summary === 'object') {
      result.summary = JSON.stringify(result.summary);
    }
    // Ensure skills are individual short strings, not long phrases
    if (result.skillsOptimized && Array.isArray(result.skillsOptimized)) {
      result.skillsOptimized = result.skillsOptimized.flatMap(s => {
        if (typeof s !== 'string') return [];
        // Split "Programming languages: Java, Python, C++" into individual skills
        if (s.includes(':')) {
          const afterColon = s.split(':')[1] || '';
          return afterColon.split(',').map(x => x.trim()).filter(Boolean);
        }
        // Split comma-separated items
        if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean);
        return [s.trim()];
      }).filter(s => s.length > 0 && s.length < 50);
    }

    res.json({ success: true, generated: result });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// GENERATE a full ResumeDraft from the user's profile (+ optional JD).
// Persists the draft and returns it — this is the entry point for the
// agent-driven Resume Canvas flow.
router.post('/drafts/generate', protect, aiLimiter, async (req, res) => {
  try {
    const { jobDescription } = req.body || {};
    // Pull a minimal profile snapshot from the User document. We only send
    // fields the LLM can actually use — never password/internal flags.
    const user = await User.findById(req.user._id)
      .select('name email bio skills expertise aimingCompany currentCompany experienceLevel experience college graduationYear linkedin github')
      .lean();
    const profile = {
      name: user?.name || '',
      email: user?.email || '',
      bio: user?.bio || '',
      skills: user?.skills || [],
      expertise: user?.expertise || [],
      aimingCompany: user?.aimingCompany || '',
      currentCompany: user?.currentCompany || '',
      experienceLevel: user?.experienceLevel || '',
      yearsOfExperience: user?.experience || 0,
      college: user?.college || '',
      graduationYear: user?.graduationYear || '',
      linkedin: user?.linkedin || '',
      github: user?.github || '',
    };

    const draft = await generateDraftFromProfile({
      userId: req.user._id,
      profile,
      jobDescription,
    });
    return res.status(201).json({ success: true, draft });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message,
    });
  }
});

// REFINE a draft with a natural-language instruction.
// Body: { instruction }  →  { success, draft, changedSections }
router.post('/drafts/:id/refine', protect, aiLimiter, async (req, res) => {
  try {
    const { instruction } = req.body || {};
    const { draft, changedSections } = await refineDraft({
      userId: req.user._id,
      draftId: req.params.id,
      instruction,
    });
    return res.json({ success: true, draft, changedSections });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message,
    });
  }
});

// Shared statusCode→response mapper for the P7 canvas service calls.
function _sendErr(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal Server Error' : err.message,
  });
}

// PATCH /drafts/:id/section — click-to-edit a single whitelisted field.
// Body: { path, value }  →  { success, draft }
router.patch('/drafts/:id/section', protect, async (req, res) => {
  try {
    const { path, value } = req.body || {};
    const draft = await applySectionEdit({ userId: req.user._id, draftId: req.params.id, path, value });
    return res.json({ success: true, draft });
  } catch (err) { return _sendErr(res, err); }
});

// POST /drafts/:id/tailor — fork a JD-tailored variant draft.
// Body: { jobDescription, company?, role? }  →  { success, draft, gaps }
router.post('/drafts/:id/tailor', protect, aiLimiter, async (req, res) => {
  try {
    const { jobDescription, company, role } = req.body || {};
    const { draft, gaps } = await tailorDraft({ userId: req.user._id, draftId: req.params.id, jobDescription, company, role });
    return res.status(201).json({ success: true, draft, gaps });
  } catch (err) { return _sendErr(res, err); }
});

// POST /drafts/:id/ats — score this draft against its stored JD on demand.
// →  { success, draft, mode, analysis }
router.post('/drafts/:id/ats', protect, aiLimiter, async (req, res) => {
  try {
    const { draft, mode, analysis } = await atsCheckDraft({ userId: req.user._id, draftId: req.params.id });
    return res.json({ success: true, draft, mode, analysis });
  } catch (err) { return _sendErr(res, err); }
});

// GET /drafts/:id/revisions — list saved revisions (newest first), no snapshots.
router.get('/drafts/:id/revisions', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.findOne({ _id: req.params.id, user: req.user._id }).select('revisions');
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    const revisions = (draft.revisions || [])
      .map((r) => ({ _id: r._id, at: r.at, label: r.label }))
      .reverse();
    return res.json({ success: true, revisions });
  } catch (err) { return _sendErr(res, err); }
});

// POST /drafts/:id/revisions/:revId/restore — restore a saved revision.
router.post('/drafts/:id/revisions/:revId/restore', protect, async (req, res) => {
  try {
    const draft = await restoreRevision({ userId: req.user._id, draftId: req.params.id, revisionId: req.params.revId });
    return res.json({ success: true, draft });
  } catch (err) { return _sendErr(res, err); }
});

// Build the structured-content payload generateDocument expects from a draft.
function _buildResumeSections(draft) {
  const p = draft.personalInfo || {};
  const sections = [];

  // Header: name + contact line + links
  const headerParas = [];
  if (p.fullName) headerParas.push(p.fullName);
  const contactBits = [p.email, p.phone, p.location].filter(Boolean);
  if (contactBits.length) headerParas.push(contactBits.join(' • '));
  const linkBits = [p.linkedin, p.github, p.portfolio].filter(Boolean);
  if (linkBits.length) headerParas.push(linkBits.join(' • '));
  if (headerParas.length) sections.push({ paragraphs: headerParas });

  if (p.summary) sections.push({ heading: 'Summary', paragraphs: [p.summary] });

  if (Array.isArray(draft.skills) && draft.skills.length) {
    sections.push({ heading: 'Skills', paragraphs: [draft.skills.join(' • ')] });
  }

  const expEntries = (draft.experience || []).filter((e) => e && (e.company || e.position));
  if (expEntries.length) {
    const paragraphs = [];
    for (const e of expEntries) {
      const title = [e.position, e.company].filter(Boolean).join(' — ');
      const dates = `${e.startDate || ''} – ${e.current ? 'Present' : (e.endDate || '')}`.trim();
      paragraphs.push([title, dates].filter(Boolean).join('  |  '));
      if (e.description) paragraphs.push(e.description);
    }
    sections.push({ heading: 'Experience', paragraphs });
  }

  const eduEntries = (draft.education || []).filter((e) => e && (e.institution || e.degree));
  if (eduEntries.length) {
    const paragraphs = [];
    for (const e of eduEntries) {
      const degree = [e.degree, e.field].filter(Boolean).join(', ');
      const dates = `${e.startDate || ''} – ${e.endDate || ''}`.trim();
      const head = [degree, dates].filter(Boolean).join('  |  ');
      if (head) paragraphs.push(head);
      const sub = [e.institution, e.gpa ? `GPA: ${e.gpa}` : ''].filter(Boolean).join(' • ');
      if (sub) paragraphs.push(sub);
    }
    sections.push({ heading: 'Education', paragraphs });
  }

  const projEntries = (draft.projects || []).filter((p) => p && p.name);
  if (projEntries.length) {
    const paragraphs = [];
    for (const pr of projEntries) {
      paragraphs.push(pr.name);
      if (pr.description) paragraphs.push(pr.description);
      if (pr.technologies) paragraphs.push(`Tech: ${pr.technologies}`);
    }
    sections.push({ heading: 'Projects', paragraphs });
  }

  // Extra sections (AI intake) — included so the ATS-plain DOCX doesn't silently
  // drop CUIC-relevant content (achievements, positions of responsibility, etc.).
  const certEntries = (draft.certifications || []).filter((c) => c && c.name);
  if (certEntries.length) {
    sections.push({ heading: 'Certifications', paragraphs: certEntries.map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(' — ')) });
  }
  const listSection = (heading, arr) => {
    const items = (arr || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (items.length) sections.push({ heading, paragraphs: items });
  };
  listSection('Achievements', draft.achievements);
  listSection('Positions of Responsibility', draft.positionsOfResponsibility);
  listSection('Languages', draft.languages);
  listSection('Hobbies', draft.hobbies);

  return { sections };
}

// EXPORT a draft to docx/pdf via the shared document service.
// Body: { format: 'docx'|'pdf' }  →  { success, artifact: {id,title,format,url} }
router.post('/drafts/:id/export', protect, async (req, res) => {
  try {
    const { format } = req.body || {};
    if (format !== 'docx' && format !== 'pdf') {
      return res.status(400).json({ success: false, message: 'format must be "docx" or "pdf"' });
    }
    const draft = await ResumeDraft.findOne({ _id: req.params.id, user: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const candidateName = (draft.personalInfo && draft.personalInfo.fullName) || req.user.name || draft.name || 'Resume';
    const titleBase = candidateName;
    const title = `${titleBase} — Resume`.slice(0, 120);

    // CUIC requires the export named `RegisterNumber_Name.pdf`. The register number
    // comes from the student's Profile (User.registerNumber); when it isn't on file
    // yet we degrade to just the name so export never blocks.
    const fileName = cuicFileName({ registerNumber: req.user.registerNumber, name: candidateName, format });

    let artifact;
    if (format === 'pdf') {
      // PDF = designed + selectable, via Puppeteer.
      artifact = await exportResumePdfArtifact({ userId: req.user._id, draft, title });
    } else {
      // DOCX = ATS-plain flat extraction (unchanged).
      const content = _buildResumeSections(draft);
      artifact = await generateDocument({ userId: req.user._id, kind: 'resume', title, format, content });
    }
    // `cuicCompliant` lets the client warn before download if sections are missing.
    return res.json({ success: true, artifact, fileName, cuic: cuicChecklist(draft) });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    });
  }
});

// GENERATE cover letter
router.post('/cover-letter', protect, aiLimiter, async (req, res) => {
  try {
    const { personalInfo, jobTitle, companyName, jobDescription, skills } = req.body;
    if (!process.env.GROQ_API_KEY) return res.status(400).json({ success: false, message: 'AI requires GROQ_API_KEY' });

    const completion = await contentCompletion({
      messages: [
        { role: 'system', content: 'You are an expert cover letter writer. Write a professional, compelling cover letter. Use the STAR method subtly. Keep it concise (3-4 paragraphs). Match keywords from the job description. Return ONLY the cover letter text.' },
        { role: 'user', content: `Write a cover letter for ${personalInfo?.fullName || 'the candidate'} applying for ${jobTitle || 'Software Engineer'} at ${companyName || 'the company'}.\n\nSkills: ${(skills || []).join(', ')}\n\nJob Description:\n${jobDescription || 'Software engineering role'}` }
      ],
      max_tokens: 800,
      temperature: 0.6
    });

    res.json({
      success: true,
      coverLetter: completion.choices[0]?.message?.content || 'Cover letter generation failed'
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
