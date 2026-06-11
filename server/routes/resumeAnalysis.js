const express = require('express');
const pdfParse = require('pdf-parse');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const { protect, isOwner } = require('../middleware/auth');
const { singleFile } = require('../middleware/upload');
const storage = require('../utils/storage');
const rateLimit = require('express-rate-limit');
const { analyzeResume } = require('../agent/services/resume');
const { emit: emitSignals } = require('../agent/services/signals');
const router = express.Router();

const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many analysis requests. Please try again later.' }
});

// POST /api/resume-analysis — accepts pasted text OR an uploaded PDF (`file`).
// The analysis (Gemini → keyword fallback) lives in the shared resume service so
// the assistant's analyze_resume tool scores identically; this route adds PDF
// extraction + persistence on top.
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

        // Shared service runs Gemini → keyword fallback and caps input length.
        const { result, mode } = await analyzeResume(resumeText, jobDescription);

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
        // P6 spine: ATS match score is the resume pillar's evidence.
        await emitSignals(req.user._id, [{
            pillar: 'resume',
            skill: 'ats_match',
            score: (Number(result.matchScore) || 0) / 100,
            source: 'resume_analysis',
            sourceId: analysis._id,
        }]);

        res.status(201).json({ success: true, analysis, mode });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message),
        });
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
