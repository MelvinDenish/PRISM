const express = require('express');
const { protect } = require('../middleware/auth');
const Groq = require('groq-sdk');
const ResumeDraft = require('../models/ResumeDraft');
const router = express.Router();

// GET user's drafts
router.get('/drafts', protect, async (req, res) => {
  try {
    const drafts = await ResumeDraft.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, drafts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single draft
router.get('/drafts/:id', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.findOne({ _id: req.params.id, user: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, draft });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// SAVE draft
router.post('/drafts', protect, async (req, res) => {
  try {
    const draft = await ResumeDraft.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, draft });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE draft
router.delete('/drafts/:id', protect, async (req, res) => {
  try {
    await ResumeDraft.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Draft deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GENERATE resume content with AI
router.post('/generate', protect, async (req, res) => {
  try {
    const { personalInfo, education, experience, skills, projects, jobDescription } = req.body;
    if (!process.env.GROQ_API_KEY) return res.status(400).json({ success: false, message: 'AI generation requires GROQ_API_KEY' });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const userProfile = JSON.stringify({ personalInfo, education, experience, skills, projects }, null, 2);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are an expert resume writer. Given user info and a job description, generate an ATS-optimized professional summary, improved experience descriptions with quantifiable achievements, and a skills section. Return JSON: { "summary": "...", "experienceDescriptions": ["..."], "skillsOptimized": ["..."], "additionalSuggestions": "..." }. Only return valid JSON.` },
        { role: 'user', content: `User profile:\n${userProfile}\n\nJob Description:\n${jobDescription || 'General software engineer role'}` }
      ],
      max_tokens: 1000,
      temperature: 0.5
    });

    let result;
    try {
      const raw = completion.choices[0]?.message?.content || '{}';
      result = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    } catch {
      result = { summary: completion.choices[0]?.message?.content, experienceDescriptions: [], skillsOptimized: skills || [] };
    }

    res.json({ success: true, generated: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GENERATE cover letter
router.post('/cover-letter', protect, async (req, res) => {
  try {
    const { personalInfo, jobTitle, companyName, jobDescription, skills } = req.body;
    if (!process.env.GROQ_API_KEY) return res.status(400).json({ success: false, message: 'AI requires GROQ_API_KEY' });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert cover letter writer. Write a professional, compelling cover letter. Use the STAR method subtly. Keep it concise (3-4 paragraphs). Match keywords from the job description.' },
        { role: 'user', content: `Write a cover letter for ${personalInfo?.fullName || 'the candidate'} applying for ${jobTitle || 'Software Engineer'} at ${companyName || 'the company'}.\n\nSkills: ${(skills || []).join(', ')}\n\nJob Description:\n${jobDescription || 'Software engineering role'}` }
      ],
      max_tokens: 800,
      temperature: 0.6
    });

    res.json({
      success: true,
      coverLetter: completion.choices[0]?.message?.content || 'Cover letter generation failed'
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
