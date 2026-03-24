const express = require('express');
const { protect } = require('../middleware/auth');
const Groq = require('groq-sdk');
const axios = require('axios');
const router = express.Router();

// POST /api/summarize — summarize an article URL
router.post('/', protect, async (req, res) => {
  try {
    const { url, text } = req.body;
    let content = text || '';

    if (url && !text) {
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM/1.0)' }
        });
        // Extract text — basic HTML stripping
        content = response.data
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000);
      } catch (fetchErr) {
        return res.status(400).json({ success: false, message: 'Cannot fetch article content. Try pasting the text instead.' });
      }
    }

    if (!content) return res.status(400).json({ success: false, message: 'No content to summarize' });

    if (!process.env.GROQ_API_KEY) {
      // Fallback: basic extractive summary (first 500 chars)
      return res.json({
        success: true,
        summary: content.slice(0, 500) + '...',
        method: 'fallback'
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a concise summarizer. Provide a clear, structured summary with key points in bullet format. Keep it under 300 words.' },
        { role: 'user', content: `Summarize this article:\n\n${content}` }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    res.json({
      success: true,
      summary: completion.choices[0]?.message?.content || 'Summary unavailable',
      method: 'ai'
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
