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

// Key authenticated requests by user id — the real per-account abuse boundary.
// Keying by IP buckets an entire NAT together, and on this platform a whole
// college campus commonly sits behind ONE public IP, so IP limits false-positive
// across unrelated students sharing that egress (every AI route 429s for everyone
// once the campus collectively crosses the window). `protect` runs before the
// ai/codeExec limiters, so req.user is always set there; the IP fallback only
// applies to the pre-auth paths on auth/general limiters (login/register).
const keyByUserOrIp = (req) => (req.user?._id ? `u:${req.user._id}` : `ip:${req.ip || 'unknown'}`);

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
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

// AI routes are expensive (Groq/Gemini tokens). This is an interactive product —
// every chat turn (resume intake, Copilot, interview game, etc.) is one request,
// and they ALL draw from this single per-user bucket — so the ceiling is a
// per-user-per-15-min cap, not a "few generations" cap. 120 bounds Groq cost
// while leaving headroom for a real back-and-forth session.
const aiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 120 });

// Code execution spawns sandboxed jobs — cap per user.
const codeExecLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 30 });

module.exports = { generalLimiter, authLimiter, aiLimiter, codeExecLimiter, keyByUserOrIp };
