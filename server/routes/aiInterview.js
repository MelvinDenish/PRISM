const express = require('express');
const { protect } = require('../middleware/auth');
const Groq = require('groq-sdk');
const User = require('../models/User');
const router = express.Router();

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

// Start AI interview — check for online mentors first
router.post('/start', protect, async (req, res) => {
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
      model: 'llama-3.1-8b-instant',
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Chat with AI interviewer
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, conversationContext } = req.body;
    const groq = getGroq();

    const messages = [
      ...conversationContext,
      { role: 'user', content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Evaluate the full interview
router.post('/evaluate', protect, async (req, res) => {
  try {
    const { conversationContext, type = 'technical' } = req.body;
    const groq = getGroq();

    const evalPrompt = `Based on this ${type} interview conversation, provide a detailed evaluation in JSON format:
{
  "overallScore": (0-100),
  "technicalSkill": (0-100),
  "communication": (0-100),
  "problemSolving": (0-100),
  "confidence": (0-100),
  "strengths": ["list of strengths"],
  "improvements": ["list of areas to improve"],
  "detailedFeedback": "2-3 paragraph detailed feedback",
  "recommendation": "Strong Hire / Hire / Maybe / No Hire"
}
Only respond with the JSON, no extra text.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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

    res.json({ success: true, evaluation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
