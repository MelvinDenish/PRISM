/**
 * Shared Group-Discussion helpers used by BOTH the solo GD (routes/groupDiscussion.js,
 * user-vs-AI-bots) and the live multi-user GD rooms (routes/gdRooms.js). Keeping
 * topic generation + score sanitizing here avoids the two routes drifting apart.
 */

const crypto = require('crypto');
const { GEN_MODEL } = require('./aiModels');

// Clamp any model-returned score into a clean 0-100 integer.
const clampScore = (v) => Math.max(0, Math.min(Math.round(Number(v) || 0), 100));

// Normalize a model-returned string list (strengths/improvements): keep strings,
// cap count + length to bound payload + prompt-injection surface.
const strList = (v) =>
  Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 6).map((s) => s.slice(0, 300)) : [];

// Static fallback topics — used when Groq is unconfigured or topic-gen fails, so a
// GD can always start (live video shouldn't hard-depend on the AI being reachable).
const GD_TOPICS = [
  'Should AI replace human jobs?',
  'Is remote work the future?',
  'Social media: boon or bane?',
  'Is a college degree still relevant?',
  'Technology vs. Privacy',
  'Climate change responsibility: individual or corporate?',
  'Should coding be mandatory in schools?',
  'Work-life balance in the tech industry',
  'Is data the new oil?',
  'Startups vs. corporate careers',
];

const randomTopic = () => GD_TOPICS[Math.floor(Math.random() * GD_TOPICS.length)];

/**
 * Generate a fresh, debatable GD topic via Groq. Falls back to a random static
 * topic on ANY error so the caller never has to handle a thrown topic.
 * @param {import('groq-sdk').Groq} groq
 * @returns {Promise<string>}
 */
async function generateTopic(groq) {
  try {
    const res = await groq.chat.completions.create({
      model: GEN_MODEL(),
      messages: [
        { role: 'system', content: 'Return ONLY a single group discussion topic as a plain string. No quotes, no explanation.' },
        { role: 'user', content: 'Generate a thought-provoking group discussion topic for a placement interview. It should be relevant to technology, business, society, or current affairs. Make it debatable with no clear "right" answer. Examples: "Should AI replace human decision-making in healthcare?", "Is remote work sustainable long-term or just a trend?"' },
      ],
      max_tokens: 100,
      temperature: 0.9,
    });
    return res.choices[0]?.message?.content?.trim() || randomTopic();
  } catch {
    return randomTopic();
  }
}

// Short, URL-safe, human-shareable invite code. Crockford-ish base32 without the
// visually ambiguous chars (I/O/0/1) so codes are easy to read aloud / type.
function genInviteCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

module.exports = { clampScore, strList, GD_TOPICS, randomTopic, generateTopic, genInviteCode };
