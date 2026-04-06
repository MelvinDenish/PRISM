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

// GENERATE resume content with AI — FIXED: structured response, no raw JSON leak
router.post('/generate', protect, async (req, res) => {
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GENERATE cover letter
router.post('/cover-letter', protect, async (req, res) => {
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
