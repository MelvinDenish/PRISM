const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const Groq = require('groq-sdk');
const ResumeDraft = require('../models/ResumeDraft');
const User = require('../models/User');
const {
  refineDraft, generateDraftFromProfile,
  applySectionEdit, tailorDraft, atsCheckDraft, restoreRevision,
} = require('../agent/services/resume');
const { generateDocument } = require('../agent/services/document');
const { LAYOUTS, FONT_PAIRS, DENSITIES, HEADING_STYLES, SECTION_KEYS, SEED_KEYS } = require('../agent/services/resumeDesign');
const router = express.Router();

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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const userProfile = JSON.stringify({ personalInfo, education, experience, skills, projects }, null, 2);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: `You are an expert ATS resume writer. Given user info and a job description, return a JSON object with EXACTLY this structure. Do NOT add any text before or after the JSON:
{
  "summary": "A 2-3 sentence professional summary paragraph (plain text, no bullet points)",
  "experienceDescriptions": [
    {
      "company": "company name",
      "position": "job title",
      "description": "2-3 sentence improved description with quantifiable achievements"
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

    const titleBase = (draft.personalInfo && draft.personalInfo.fullName)
      || draft.name
      || 'Resume';
    const title = `${titleBase} — Resume`.slice(0, 120);

    const content = _buildResumeSections(draft);
    const artifact = await generateDocument({
      userId: req.user._id,
      kind: 'resume',
      title,
      format,
      content,
    });
    return res.json({ success: true, artifact });
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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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
