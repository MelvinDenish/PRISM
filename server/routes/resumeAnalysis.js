const express = require('express');
const pdfParse = require('pdf-parse');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { protect, isOwner } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');
const storage = require('../utils/storage');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many analysis requests. Please try again later.' }
});

// Common, low-signal words to ignore when keyword-matching a JD against a resume.
const STOPWORDS = new Set([
    'this', 'that', 'with', 'have', 'will', 'your', 'from', 'they', 'their', 'about',
    'which', 'would', 'there', 'been', 'were', 'when', 'what', 'into', 'than', 'them',
    'then', 'some', 'such', 'only', 'also', 'more', 'most', 'other', 'must', 'should',
    'role', 'work', 'team', 'years', 'year', 'using', 'used', 'strong', 'good', 'plus',
    'looking', 'experience', 'preferred', 'required', 'skills', 'ability', 'knowledge'
]);

/**
 * Deterministic keyword-overlap analysis. Always returns a usable result — this is
 * the safety net whenever the AI path is unavailable (no key, rate-limited, errored).
 */
function keywordAnalysis(resumeText, jobDescription) {
    const jdWords = jobDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
    const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/));
    const unique = [...new Set(jdWords)];
    const allMissing = unique.filter((w) => !resumeWords.has(w));
    // Guard against an all-short-words JD (unique.length === 0 → NaN).
    const matchScore = unique.length > 0
        ? Math.round(((unique.length - allMissing.length) / unique.length) * 100)
        : 0;
    const redFlags = [];
    if (resumeText.length < 300) redFlags.push('Resume looks very short — add more detail on projects and impact.');
    if (!/\d/.test(resumeText)) redFlags.push('No numbers/metrics found — quantify your achievements (e.g. "improved latency by 30%").');
    return {
        matchScore,
        missingKeywords: allMissing.slice(0, 20),
        suggestions: `Keyword analysis: your resume covers ${unique.length - allMissing.length} of ${unique.length} key terms from the job description. Add the missing keywords where they genuinely apply, and mirror the JD's wording. (AI-powered analysis was unavailable, so this is a keyword-based estimate.)`,
        redFlags,
        starSuggestions: []
    };
}

/**
 * AI-powered analysis via Gemini. Returns a parsed result object, or `null` when the
 * response was not usable (caller then falls back to keywordAnalysis). Throws only on
 * unexpected programming errors — network/HTTP/parse issues resolve to `null`.
 */
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
  "redFlags": [<array of ATS formatting issues like tables, images, special chars that break parsing>],
  "suggestions": "<detailed paragraph with improvement suggestions>",
  "starSuggestions": [<array of STAR-method rewrite suggestions for existing bullet points>]
}`;

    let response;
    try {
        response = await fetch(
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
    } catch {
        return null; // network failure → fall back
    }

    if (!response.ok) return null; // 4xx/5xx (e.g. 429 quota) → fall back

    const data = await response.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let parsed;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return null; // unparseable → fall back
    }

    // Require a real score; treat a 0/empty AI payload as a failure, not a result.
    const matchScore = Number(parsed.matchScore) || 0;
    const hasContent = matchScore > 0 || (Array.isArray(parsed.missingKeywords) && parsed.missingKeywords.length) || (parsed.suggestions && parsed.suggestions.length > 10);
    if (!hasContent) return null;

    return {
        matchScore,
        missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        suggestions: parsed.suggestions || '',
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
        starSuggestions: Array.isArray(parsed.starSuggestions) ? parsed.starSuggestions : []
    };
}

// POST /api/resume-analysis — accepts pasted text OR an uploaded PDF (`file`).
router.post('/', protect, analysisLimiter, singleFile, async (req, res) => {
    try {
        let { resumeText } = req.body;
        const { jobDescription } = req.body;
        let savedFile = null; // { url, key } when an uploaded PDF is persisted

        // If a PDF was uploaded, extract its text server-side (pdf-parse).
        if (req.file) {
            if (req.file.mimetype !== 'application/pdf') {
                return res.status(400).json({ success: false, message: 'Please upload a PDF resume.' });
            }
            try {
                const parsed = await pdfParse(req.file.buffer);
                resumeText = (parsed.text || '').trim();
            } catch (e) {
                return res.status(422).json({ success: false, message: 'Could not read text from that PDF. Try pasting the text instead.' });
            }
            if (!resumeText) {
                return res.status(422).json({ success: false, message: 'No selectable text found in the PDF (it may be a scanned image).' });
            }
            // Persist the original PDF through the storage seam (local | s3) so the
            // user can re-open it later. Best-effort: never fail the analysis on a
            // storage error — the text is already extracted.
            try {
                savedFile = await storage.saveFile({
                    buffer: req.file.buffer,
                    mimeType: req.file.mimetype,
                    originalName: req.file.originalname,
                    folder: 'resumes',
                });
            } catch (storageErr) {
                console.warn('Resume PDF storage failed (analysis continues):', storageErr.message);
            }
        }

        if (!resumeText || !jobDescription) {
            return res.status(400).json({ success: false, message: 'Resume (text or PDF) and job description are required' });
        }

        // Cap user input before it reaches the AI prompt (cost/abuse + prompt-injection surface).
        const MAX_INPUT = 20000; // ~20KB each is plenty for a resume / JD
        if (resumeText.length > MAX_INPUT || jobDescription.length > MAX_INPUT) {
            return res.status(400).json({ success: false, message: `Resume and job description must each be under ${MAX_INPUT} characters` });
        }

        let result = null;
        let mode = 'keyword';

        // Try Gemini first when configured. ANY failure (network, non-2xx, empty
        // body, unparseable JSON) must fall through to keyword matching — never
        // persist an all-zero "successful" analysis (bug R1).
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
            try {
                result = await geminiAnalysis(resumeText, jobDescription);
                if (result) mode = 'ai';
            } catch (aiErr) {
                // swallow — we degrade to keyword matching below
                console.warn('Gemini resume analysis failed, falling back to keyword match:', aiErr.message);
            }
        }

        if (!result) {
            result = keywordAnalysis(resumeText, jobDescription);
        }

        const analysis = await ResumeAnalysis.create({
            user: req.user._id,
            resumeUrl: savedFile?.url || req.body.resumeUrl || '',
            fileKey: savedFile?.key || '',
            storageDriver: savedFile ? storage.driver : '',
            jobDescription,
            matchScore: result.matchScore,
            missingKeywords: result.missingKeywords,
            suggestions: result.suggestions,
            redFlags: result.redFlags,
            starSuggestions: result.starSuggestions
        });

        res.status(201).json({ success: true, analysis, mode });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

// GET /api/resume-analysis - Get user's analysis history
router.get('/', protect, async (req, res) => {
    try {
        const analyses = await ResumeAnalysis.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, analyses });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
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
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
