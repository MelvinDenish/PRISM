/**
 * Rate limiters (Phase 0 foundation, see plan §4).
 *
 * Today only /resume-analysis is protected. These shared limiters cover the
 * abuse-prone surfaces: auth (brute force), AI routes (cost), and code
 * execution (resource exhaustion).
 *
 * NOTE: uses express-rate-limit's default in-memory store, which is
 * per-process. Once the Redis adapter lands (plan Phase 2) swap in
 * rate-limit-redis so limits hold across the PM2 cluster.
 */

const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
};

// Broad safety net for the whole API.
const generalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 1000 });

// Strict: login/register/password-reset — throttles credential stuffing.
const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { success: false, message: 'Too many authentication attempts, please try again in 15 minutes.' },
});

// AI routes are expensive (Groq/Gemini tokens).
const aiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 40 });

// Code execution spawns sandboxed jobs — cap per user/IP.
const codeExecLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 30 });

module.exports = { generalLimiter, authLimiter, aiLimiter, codeExecLimiter };
