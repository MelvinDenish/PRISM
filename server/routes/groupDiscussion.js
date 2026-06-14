const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { getGroq, GEN_MODEL, evalCompletion } = require('../utils/aiModels');
const { rubricBlock, RUBRIC_VERSION } = require('../utils/interviewRubric');
const mongoose = require('mongoose');
const GDSession = require('../models/GDSession');
const router = express.Router();

const clampScore = (v) => Math.max(0, Math.min(Math.round(Number(v) || 0), 100));
const strList = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 6).map((s) => s.slice(0, 300)) : []);

// Cap client-supplied AI context to bound Groq token cost and the
// prompt-injection surface (the client echoes the running transcript).
const MAX_CONTEXT_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const sanitizeContext = (context) =>
  (Array.isArray(context) ? context : [])
    .slice(-MAX_CONTEXT_MESSAGES)
    .filter((m) => m && typeof m.content === 'string' && typeof m.role === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

// Rebuild a {speaker,message}[] transcript from the sanitized context. Lines are
// stored as "Name: text"; split on the first short colon, else label by role.
const transcriptFromContext = (ctx) => ctx
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => {
    const txt = String(m.content || '');
    const i = txt.indexOf(':');
    return (i > 0 && i <= 24)
      ? { speaker: txt.slice(0, i).trim(), message: txt.slice(i + 1).trim() }
      : { speaker: m.role === 'user' ? 'You' : 'Participant', message: txt };
  })
  .slice(-MAX_CONTEXT_MESSAGES);

// AI participant profiles for GD
const PARTICIPANTS = [
  { name: 'Ananya', style: 'analytical and data-driven, uses statistics and facts to support arguments', college: 'IIT Bombay' },
  { name: 'Rahul', style: 'passionate and opinionated, tends to take strong stances and challenge others', college: 'NIT Trichy' },
  { name: 'Priya', style: 'balanced and diplomatic, tries to find middle ground and synthesize different viewpoints', college: 'BITS Pilani' },
  { name: 'Vikram', style: 'practical and example-focused, uses real-world examples and case studies', college: 'IIIT Hyderabad' },
  { name: 'Sneha', style: 'creative and unconventional thinker, brings unique perspectives others might miss', college: 'DTU' },
];

// POST /api/group-discussion/start — Generate topic and start GD with AI participants
router.post('/start', protect, aiLimiter, async (req, res) => {
  try {
    const groq = getGroq();
    const { customTopic } = req.body;

    // Generate a GD topic if none provided
    let topic = typeof customTopic === 'string' ? customTopic.slice(0, 500) : '';
    if (!topic) {
      const topicRes = await groq.chat.completions.create({
        model: GEN_MODEL(),
        messages: [
          { role: 'system', content: 'Return ONLY a single group discussion topic as a plain string. No quotes, no explanation.' },
          { role: 'user', content: 'Generate a thought-provoking group discussion topic for a placement interview. It should be relevant to technology, business, society, or current affairs. Make it debatable with no clear "right" answer. Examples: "Should AI replace human decision-making in healthcare?", "Is remote work sustainable long-term or just a trend?"' }
        ],
        max_tokens: 100,
        temperature: 0.9
      });
      topic = topicRes.choices[0]?.message?.content?.trim() || 'Is artificial intelligence a threat or an opportunity for the workforce?';
    }

    // Select 4-5 random AI participants
    const shuffled = [...PARTICIPANTS].sort(() => Math.random() - 0.5);
    const selectedParticipants = shuffled.slice(0, 4 + Math.floor(Math.random() * 2));

    // Generate opening statement from first AI participant
    const openingRes = await groq.chat.completions.create({
      model: GEN_MODEL(),
      messages: [
        { role: 'system', content: `You are ${selectedParticipants[0].name}, a ${selectedParticipants[0].style}. You are in a group discussion for a placement interview. The topic is: "${topic}". Give your opening statement in 2-3 sentences. Be natural, speak in first person, and take a clear stance. Do NOT use your name in the response.` },
        { role: 'user', content: 'Start the group discussion with your opening statement.' }
      ],
      max_tokens: 200,
      temperature: 0.8
    });

    const openingMessage = openingRes.choices[0]?.message?.content?.trim() || 'I think this is a very important topic that needs careful consideration.';

    res.json({
      success: true,
      topic,
      participants: selectedParticipants.map(p => ({ name: p.name, college: p.college })),
      discussion: [
        { speaker: selectedParticipants[0].name, message: openingMessage, college: selectedParticipants[0].college }
      ],
      context: [
        { role: 'system', content: `Group discussion topic: "${topic}". Participants: ${selectedParticipants.map(p => `${p.name} (${p.style})`).join(', ')} and the candidate (user). This is a placement interview GD.` },
        { role: 'assistant', content: `${selectedParticipants[0].name}: ${openingMessage}` }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

// POST /api/group-discussion/respond — User speaks, AI participants respond
router.post('/respond', protect, aiLimiter, async (req, res) => {
  try {
    const { userMessage, participants, topic } = req.body;
    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      return res.status(400).json({ success: false, message: 'A message is required' });
    }
    const groq = getGroq();

    // Add user's message to context
    const updatedContext = [
      ...sanitizeContext(req.body.context),
      { role: 'user', content: `Candidate: ${userMessage.slice(0, MAX_MESSAGE_CHARS)}` }
    ];

    // Pick 1-2 AI participants to respond
    const safeParticipants = Array.isArray(participants) ? participants : [];
    const respondCount = 1 + Math.floor(Math.random() * 2);
    const responders = [...safeParticipants].sort(() => Math.random() - 0.5).slice(0, respondCount);

    const responses = [];
    let runningContext = [...updatedContext];

    for (const responder of responders) {
      const participant = PARTICIPANTS.find(p => p.name === responder.name) || responder;

      const completion = await groq.chat.completions.create({
        model: GEN_MODEL(),
        messages: [
          ...runningContext,
          { role: 'user', content: `Now ${participant.name} responds. ${participant.name} is ${participant.style || 'thoughtful and articulate'}. Topic: "${topic}". Respond naturally in 2-3 sentences. You may agree, disagree, counter-argue, add new points, or build upon what the candidate said. Be conversational and realistic. Speak in first person. Return ONLY the response text, no name prefix.` }
        ],
        max_tokens: 200,
        temperature: 0.8
      });

      const aiReply = completion.choices[0]?.message?.content?.trim() || 'That\'s an interesting point. I would like to add...';
      responses.push({ speaker: participant.name, message: aiReply, college: participant.college || '' });
      runningContext.push({ role: 'assistant', content: `${participant.name}: ${aiReply}` });
    }

    res.json({
      success: true,
      responses,
      context: runningContext
    });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

// POST /api/group-discussion/evaluate — Evaluate user's GD performance
router.post('/evaluate', protect, aiLimiter, async (req, res) => {
  try {
    const { topic } = req.body;
    const context = sanitizeContext(req.body.context);
    const groq = getGroq();

    const { completion: evalRes, modelUsed } = await evalCompletion(groq, {
      messages: [
        ...context,
        { role: 'user', content: `Evaluate the candidate's performance in this group discussion on "${topic}".

${rubricBlock()}

Return ONLY valid JSON:
{
  "overallScore": (0-100),
  "communication": (0-100),
  "contentQuality": (0-100),
  "leadership": (0-100),
  "teamwork": (0-100),
  "reasoning": (0-100),
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "detailedFeedback": "2-3 paragraph evaluation",
  "verdict": "Excellent/Good/Average/Below Average"
}` }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    let evaluation;
    try {
      const raw = evalRes.choices[0]?.message?.content || '{}';
      evaluation = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      evaluation = { overallScore: 60, detailedFeedback: evalRes.choices[0]?.message?.content, verdict: 'Review needed' };
    }

    // Persist the SERVER-computed scores so the game round (and history) read an
    // authoritative number, not the client's. Best-effort: history is non-critical.
    let gdSessionId = null;
    try {
      const doc = await GDSession.create({
        user: req.user._id,
        game: mongoose.isValidObjectId(req.body.gameId) ? req.body.gameId : null,
        topic: String(topic || '').slice(0, 500),
        transcript: transcriptFromContext(context),
        scores: {
          overall: clampScore(evaluation.overallScore),
          communication: clampScore(evaluation.communication),
          contentQuality: clampScore(evaluation.contentQuality),
          leadership: clampScore(evaluation.leadership),
          teamwork: clampScore(evaluation.teamwork),
          reasoning: clampScore(evaluation.reasoning),
        },
        feedback: {
          strengths: strList(evaluation.strengths),
          improvements: strList(evaluation.improvements),
          detailedFeedback: String(evaluation.detailedFeedback || '').slice(0, 4000),
          verdict: String(evaluation.verdict || ''),
        },
        rubricVersion: RUBRIC_VERSION || '',
        gradedBy: modelUsed || '',
      });
      gdSessionId = doc._id;
    } catch (e) { console.warn('GDSession persist failed:', e.message); }

    res.json({ success: true, evaluation, gdSessionId });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

// GET /api/group-discussion/history — recent solo-GD scorecards for trends.
router.get('/history', protect, async (req, res) => {
  try {
    const sessions = await GDSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('topic scores feedback.verdict createdAt')
      .lean();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

module.exports = router;
