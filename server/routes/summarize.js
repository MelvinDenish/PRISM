const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { assertSafeUrl } = require('../utils/urlGuard');
const { chatCompletion } = require('../utils/aiModels');
const axios = require('axios');
const router = express.Router();

const MAX_TEXT_CHARS = 50000; // cap pasted text to bound AI cost

// POST /api/summarize — summarize an article URL or pasted text
router.post('/', protect, aiLimiter, async (req, res) => {
  try {
    const { url, text } = req.body;
    let content = typeof text === 'string' ? text.slice(0, MAX_TEXT_CHARS) : '';

    if (url && !content) {
      if (typeof url !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid URL' });
      }
      // SSRF guard: only http(s), and reject hosts that resolve to internal IPs.
      const safe = await assertSafeUrl(url);
      if (!safe.ok) {
        return res.status(400).json({ success: false, message: safe.reason });
      }
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          maxRedirects: 0,            // do not follow redirects (SSRF bypass vector)
          maxContentLength: 5 * 1024 * 1024, // 5MB cap
          responseType: 'text',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM/1.0)' },
          validateStatus: (s) => s >= 200 && s < 300, // reject 3xx redirects too
        });
        // Extract text — basic HTML stripping
        content = String(response.data)
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

    const completion = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a concise summarizer. Provide a clear, structured summary with key points in bullet format. Keep it under 300 words.' },
        { role: 'user', content: `Summarize this article:\n\n${content}` }
      ],
      max_tokens: 500,
      temperature: 0.3
    }, 'fast');

    res.json({
      success: true,
      summary: completion.choices[0]?.message?.content || 'Summary unavailable',
      method: 'ai'
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
