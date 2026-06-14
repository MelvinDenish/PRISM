const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { getGroq, GEN_MODEL, evalCompletion } = require('../utils/aiModels');
const { rubricBlock, RUBRIC_VERSION } = require('../utils/interviewRubric');
const User = require('../models/User');
const InterviewAttempt = require('../models/InterviewAttempt');
const { emit: emitSignals } = require('../agent/services/signals');
const router = express.Router();

// Cap client-supplied AI conversation context to bound Groq token cost and
// limit the prompt-injection surface (the client echoes the whole transcript).
const MAX_CONTEXT_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const sanitizeContext = (context) =>
  (Array.isArray(context) ? context : [])
    .slice(-MAX_CONTEXT_MESSAGES)
    .filter((m) => m && typeof m.content === 'string' && typeof m.role === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

// Start AI interview — check for online mentors first
router.post('/start', protect, aiLimiter, async (req, res) => {
  try {
    const { type = 'technical', topic = 'general' } = req.body;
    // Check for online mentors (simplified: check recent activity)
    const onlineMentors = await User.find({ role: 'mentor', isOnline: true }).limit(5);

    let mode = 'ai';
    if (onlineMentors.length > 0) {
      mode = 'mentor-available';
    }

    // Generate first question from AI
    const groq = getGroq();
    const systemPrompt = type === 'technical'
      ? `You are an expert technical interviewer at a top tech company. Ask focused ${topic} questions. Start with medium difficulty and adapt based on responses. Ask one question at a time. Be professional but conversational.`
      : type === 'hr'
      ? `You are an experienced HR interviewer. Ask behavioral and situational questions. Evaluate communication skills, attitude, and cultural fit. Ask one question at a time.`
      : `You are a group discussion moderator. Present a topic and guide discussion. Evaluate communication, reasoning, and leadership skills.`;

    const completion = await groq.chat.completions.create({
      model: GEN_MODEL(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Start the ${type} interview. The candidate's topic of interest is: ${topic}. Begin with your first question.` }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const firstQuestion = completion.choices[0]?.message?.content || 'Tell me about your experience.';
    res.json({
      success: true,
      mode,
      availableMentors: mode === 'mentor-available' ? onlineMentors.map(m => ({ _id: m._id, name: m.name, currentCompany: m.currentCompany })) : [],
      aiMessage: firstQuestion,
      conversationContext: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: firstQuestion }
      ]
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// Chat with AI interviewer
router.post('/chat', protect, aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    const groq = getGroq();

    const messages = [
      ...sanitizeContext(req.body.conversationContext),
      { role: 'user', content: message.slice(0, MAX_MESSAGE_CHARS) }
    ];

    const completion = await groq.chat.completions.create({
      model: GEN_MODEL(),
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Could you elaborate on that?';
    res.json({
      success: true,
      aiMessage: aiResponse,
      updatedContext: [...messages, { role: 'assistant', content: aiResponse }]
    });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

// Evaluate the full interview
router.post('/evaluate', protect, aiLimiter, async (req, res) => {
  try {
    const { type = 'technical' } = req.body;
    const conversationContext = sanitizeContext(req.body.conversationContext);

    // Validate: user must have sent at least 2 messages
    const userMessages = conversationContext.filter(m => m.role === 'user');
    if (userMessages.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'You need to answer at least 2 questions before getting an evaluation. Keep going!'
      });
    }

    const groq = getGroq();

    // Build a strict evaluation prompt with an anchored rubric (B4) so scores are
    // comparable across runs. Graded on the stronger eval model (B1, with fallback).
    const evalPrompt = `Based on this ${type} interview conversation, provide a detailed evaluation in JSON format.
The candidate answered ${userMessages.length} questions. Score STRICTLY based on the quality and depth of their actual responses.

${rubricBlock()}

{
  "overallScore": (0-100),
  "technicalSkill": (0-100),
  "communication": (0-100),
  "problemSolving": (0-100),
  "confidence": (0-100),
  "strengths": ["list of strengths based on actual responses"],
  "improvements": ["list of areas to improve based on actual responses"],
  "detailedFeedback": "2-3 paragraph detailed feedback referencing specific answers",
  "recommendation": "Strong Hire / Hire / Maybe / No Hire"
}
Only respond with the JSON, no extra text.`;

    const { completion, modelUsed } = await evalCompletion(groq, {
      messages: [
        ...conversationContext,
        { role: 'user', content: evalPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    let evaluation;
    try {
      const raw = completion.choices[0]?.message?.content || '{}';
      evaluation = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
    } catch {
      evaluation = { overallScore: 65, detailedFeedback: completion.choices[0]?.message?.content, recommendation: 'Review needed' };
    }

    // Persist ONLY for standalone AI interviews (client passes persist:true). The
    // Interview Game calls this same endpoint for its HR/technical2 rounds but
    // persists those itself — so it omits the flag and we don't double-count.
    let attemptId;
    if (req.body.persist === true && (type === 'technical' || type === 'hr')) {
      try {
        const dims = {};
        for (const k of ['technicalSkill', 'communication', 'problemSolving', 'confidence']) {
          if (Number.isFinite(Number(evaluation[k]))) dims[k] = Number(evaluation[k]);
        }
        const attempt = await InterviewAttempt.create({
          user: req.user._id,
          type,
          topic: typeof req.body.topic === 'string' ? req.body.topic.slice(0, 200) : '',
          overallScore: Number(evaluation.overallScore) || 0,
          dimensions: dims,
          strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 10).map(String) : [],
          improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.slice(0, 10).map(String) : [],
          detailedFeedback: typeof evaluation.detailedFeedback === 'string' ? evaluation.detailedFeedback : '',
          recommendation: typeof evaluation.recommendation === 'string' ? evaluation.recommendation : '',
          questionsAnswered: userMessages.length,
          rubricVersion: RUBRIC_VERSION,
          model: modelUsed,
        });
        attemptId = attempt._id;
        // P6 spine: only standalone interviews emit (the Interview Game's rounds
        // already emit via /submit-round — persist:false there, no double count).
        await emitSignals(req.user._id, [{
          pillar: type === 'technical' ? 'cs_core' : 'communication',
          skill: typeof req.body.topic === 'string' ? req.body.topic.slice(0, 60) : type,
          score: (Number(evaluation.overallScore) || 0) / 100,
          source: 'ai_interview',
          sourceId: attempt._id,
        }]);
      } catch (saveErr) {
        // Persistence is best-effort — never fail the evaluation because of it.
        console.warn('InterviewAttempt save failed:', saveErr.message);
      }
    }

    res.json({ success: true, evaluation, attemptId });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message }); }
});

module.exports = router;
