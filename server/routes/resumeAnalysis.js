const express = require('express');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { protect, isOwner } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many analysis requests. Please try again later.' }
});

// POST /api/resume-analysis
router.post('/', protect, analysisLimiter, async (req, res) => {
    try {
        const { resumeText, jobDescription } = req.body;

        if (!resumeText || !jobDescription) {
            return res.status(400).json({ success: false, message: 'Resume text and job description are required' });
        }

        // Cap user input before it reaches the AI prompt (cost/abuse + prompt-injection surface).
        const MAX_INPUT = 20000; // ~20KB each is plenty for a resume / JD
        if (resumeText.length > MAX_INPUT || jobDescription.length > MAX_INPUT) {
            return res.status(400).json({ success: false, message: `Resume and job description must each be under ${MAX_INPUT} characters` });
        }

        let matchScore = 0;
        let missingKeywords = [];
        let suggestions = '';
        let redFlags = [];
        let starSuggestions = [];

        // Use Gemini API if configured
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
            try {
                const prompt = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze the following resume against the job description and provide a structured JSON response.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond ONLY with a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "matchScore": <number 0-100 representing ATS match percentage>,
  "missingKeywords": [<array of important keywords found in JD but missing from resume>],
  "redFlags": [<array of ATS formatting issues like tables, images, special chars that break parsing>],
  "suggestions": "<detailed paragraph with improvement suggestions>",
  "starSuggestions": [<array of STAR-method rewrite suggestions for existing bullet points>]
}`;

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.3 }
                        })
                    }
                );

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Parse JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    matchScore = parsed.matchScore || 0;
                    missingKeywords = parsed.missingKeywords || [];
                    suggestions = parsed.suggestions || '';
                    redFlags = parsed.redFlags || [];
                    starSuggestions = parsed.starSuggestions || [];
                }
            } catch (aiErr) {
                suggestions = `AI analysis unavailable: ${aiErr.message}. Please check your API key.`;
            }
        } else {
            // Basic keyword matching fallback
            const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/));
            const unique = [...new Set(jdWords)];
            missingKeywords = unique.filter(w => !resumeWords.has(w)).slice(0, 20);
            matchScore = Math.round(((unique.length - missingKeywords.length) / unique.length) * 100);
            suggestions = 'Configure GEMINI_API_KEY in .env for AI-powered analysis. Basic keyword matching was used.';
        }

        const analysis = await ResumeAnalysis.create({
            user: req.user._id,
            resumeUrl: req.body.resumeUrl || '',
            jobDescription,
            matchScore,
            missingKeywords,
            suggestions,
            redFlags,
            starSuggestions
        });

        res.status(201).json({ success: true, analysis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/resume-analysis - Get user's analysis history
router.get('/', protect, async (req, res) => {
    try {
        const analyses = await ResumeAnalysis.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, analyses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/resume-analysis/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const analysis = await ResumeAnalysis.findById(req.params.id);
        if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
        // Ownership: prevent IDOR — only the owner (or an admin) may view an analysis.
        if (!isOwner(analysis, req)) return res.status(403).json({ success: false, message: 'Not authorized' });
        res.json({ success: true, analysis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
