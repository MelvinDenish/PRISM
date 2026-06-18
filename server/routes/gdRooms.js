const express = require('express');
const GDRoom = require('../models/GDRoom');
const GDSession = require('../models/GDSession');
const { protect, authorize } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { config } = require('../config/env');
const { evalCompletion } = require('../utils/aiModels');
const { rubricBlock, RUBRIC_VERSION } = require('../utils/interviewRubric');
const { generateTopic, randomTopic, genInviteCode, clampScore, strList } = require('../utils/gd');
const router = express.Router();

const sameId = (a, b) => String(a) === String(b);
const isAdmin = (u) => u.role === 'admin';
const MAX_TRANSCRIPT_CHARS = 8000;
const prodSafe = (error) => (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message);

// A caller may see / re-enter a room if they host it, joined it, or were invited.
const canAccess = (room, user) =>
  isAdmin(user) ||
  sameId(room.host, user._id) ||
  room.participants.some((p) => sameId(p._id || p, user._id)) ||
  room.invitedUsers.some((p) => sameId(p._id || p, user._id));

// Generate a collision-free invite code (codes are short, so retry a few times).
async function uniqueInviteCode() {
  for (let i = 0; i < 6; i++) {
    const code = genInviteCode();
    if (!(await GDRoom.exists({ inviteCode: code }))) return code;
  }
  return genInviteCode(8); // longer code → effectively no collision
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gd-rooms — ONLY rooms the caller hosts, joined, or was invited to.
// (Rooms are private now; there is no global discovery list.)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const me = req.user._id;
    // Self-healing cleanup: drop this user's OWN rooms that ended a while ago, so
    // completed GDs/webinars don't pile up. The grace window lets late participants
    // still POST /:id/evaluate right after the end.
    GDRoom.deleteMany({ host: me, status: 'completed', endedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }).catch(() => {});

    // Only the caller's rooms, and only ones that are still going (waiting/active) —
    // never list other people's rooms, and never list ended ones.
    // Also hide code-less rooms: every room/webinar now gets an inviteCode on create,
    // so a room without one is legacy junk that can never be joined — don't surface it.
    const filter = {
      $or: [{ host: me }, { participants: me }, { invitedUsers: me }],
      status: req.query.status || { $ne: 'completed' },
      inviteCode: { $exists: true, $nin: [null, ''] },
    };
    const rooms = await GDRoom.find(filter)
      .populate('participants', 'name')
      .populate('host', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// GET /api/gd-rooms/:id — single room (must be a member).
router.get('/:id', protect, async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id).populate('participants', 'name').populate('host', 'name');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!canAccess(room, req.user)) return res.status(403).json({ success: false, message: 'Not authorized for this room' });
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// POST /api/gd-rooms — create a GROUP discussion room (mentees only; mentors host
// webinars instead via POST /api/webinars). Topic is revealed at Start, not now.
router.post('/', protect, authorize('mentee', 'admin'), async (req, res) => {
  try {
    const mode = 'group'; // this endpoint only creates peer GD rooms
    const room = await GDRoom.create({
      maxParticipants: mode === 'webinar' ? 100 : (req.body.maxParticipants || 6),
      mode,
      participants: [req.user._id],
      host: req.user._id,
      inviteCode: await uniqueInviteCode(),
    });
    const populated = await GDRoom.findById(room._id).populate('participants', 'name').populate('host', 'name');
    res.status(201).json({ success: true, room: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// POST /api/gd-rooms/join-by-code — the gated entry point. { code }
router.post('/join-by-code', protect, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'An invite code is required' });

    const room = await GDRoom.findOne({ inviteCode: code });
    if (!room) return res.status(404).json({ success: false, message: 'Invalid invite code' });

    if (room.mode === 'webinar') {
      // Webinars are invite-only: must be on the allowlist (or host/admin).
      const allowed = isAdmin(req.user) || sameId(room.host, req.user._id) ||
        room.invitedUsers.some((u) => sameId(u, req.user._id));
      if (!allowed) return res.status(403).json({ success: false, message: 'This webinar is invite-only' });
    } else {
      // Group room: anyone with the code joins as a participant (capacity-checked).
      if (!room.participants.some((p) => sameId(p, req.user._id))) {
        if (room.participants.length >= room.maxParticipants) {
          return res.status(400).json({ success: false, message: 'Room is full' });
        }
        room.participants.push(req.user._id);
        await room.save();
      }
    }

    const populated = await GDRoom.findById(room._id).populate('participants', 'name').populate('host', 'name');
    res.json({ success: true, room: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// PATCH /api/gd-rooms/:id/join — re-enter a room you already belong to (host /
// participant / invited). Public joining is ONLY via /join-by-code.
router.patch('/:id/join', protect, async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!canAccess(room, req.user)) {
      return res.status(403).json({ success: false, message: 'Join with the invite code first' });
    }
    // Group members not yet in the participant list (e.g. invited) get added.
    if (room.mode === 'group' && !room.participants.some((p) => sameId(p, req.user._id))) {
      if (room.participants.length >= room.maxParticipants) {
        return res.status(400).json({ success: false, message: 'Room is full' });
      }
      room.participants.push(req.user._id);
      await room.save();
    }
    const populated = await GDRoom.findById(room._id).populate('participants', 'name').populate('host', 'name');
    res.json({ success: true, room: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// POST /api/gd-rooms/:id/start — HOST-ONLY. Reveal a fresh topic, go active, and
// broadcast gd-started so every client enables cam/mic and starts the timer.
router.post('/:id/start', protect, async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!sameId(room.host, req.user._id) && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only the host can start the discussion' });
    }

    const topic = config.hasGroq() ? await generateTopic() : randomTopic();
    const duration = Math.min(Math.max(parseInt(req.body.duration, 10) || 10, 1), 60); // minutes
    room.gdTopic = topic;
    room.status = 'active';
    room.startedAt = new Date();
    await room.save();

    req.app.get('io')?.to(`gd-${room._id}`).emit('gd-started', { topic, duration });

    const populated = await GDRoom.findById(room._id).populate('participants', 'name').populate('host', 'name');
    res.json({ success: true, room: populated, topic, duration });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// POST /api/gd-rooms/:id/end — HOST-ONLY. Mark completed and tell the room.
router.post('/:id/end', protect, async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!sameId(room.host, req.user._id) && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only the host can end the discussion' });
    }
    room.status = 'completed';
    room.endedAt = new Date();
    await room.save();
    req.app.get('io')?.to(`gd-${room._id}`).emit('gd-ended', { message: '🔔 GD session has ended!' });
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// A participant who barely/never spoke — guaranteed, deterministic feedback that
// makes "you need to speak more" the headline. No model call needed.
function silentScorecard() {
  return {
    overallScore: 8,
    communication: 5, contentQuality: 5, leadership: 5, teamwork: 8, reasoning: 5,
    strengths: ['You stayed for the full discussion.'],
    improvements: [
      'You did not speak during this discussion — active participation is the single most important thing to improve.',
      'Aim to make at least 2-3 points next time: state your view early, then build on or counter others.',
    ],
    detailedFeedback: 'No spoken contribution was detected for you in this group discussion. In a placement GD, staying silent is scored as a non-attempt — evaluators cannot assess communication, reasoning, or leadership without hearing your views. Your priority is simply to speak: prepare one opening point on the topic and jump in within the first minute.',
    verdict: 'Below Average',
  };
}

// Participation-only scorecard when Groq is unavailable: scale by how much they
// spoke so the feature still works (and still rewards speaking up) without AI.
function heuristicScorecard({ spokenSeconds, turns, spokePct }) {
  const base = clampScore(Math.min(spokePct * 1.4, 85)); // share of airtime, capped
  const engagement = clampScore(Math.min(turns * 12, 80)); // rewards multiple turns
  return {
    overallScore: clampScore((base + engagement) / 2),
    communication: base, contentQuality: clampScore(base * 0.9), leadership: engagement,
    teamwork: clampScore((base + engagement) / 2), reasoning: clampScore(base * 0.9),
    strengths: turns > 1 ? ['You contributed multiple times and engaged with the discussion.'] : ['You participated in the discussion.'],
    improvements: [
      spokePct < 20 ? 'Increase your share of speaking time — aim to contribute more substantively.'
        : 'Keep sharpening your points with concrete examples and clear structure.',
    ],
    detailedFeedback: `You spoke for about ${spokenSeconds}s across ${turns} turn(s) (~${spokePct}% of the group's speaking time). AI content analysis was unavailable, so this score reflects participation only. Speaking more — and structuring each point (claim → reason → example) — is the fastest way to improve.`,
    verdict: spokePct >= 25 ? 'Average' : 'Below Average',
  };
}

// POST /api/gd-rooms/:id/evaluate — each participant SELF-SUBMITS their own
// transcript + participation; the server scores THEM and persists one GDSession.
router.post('/:id/evaluate', protect, aiLimiter, async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id).select('participants host invitedUsers gdTopic mode');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.mode === 'webinar') {
      return res.status(400).json({ success: false, message: 'Evaluation applies to group discussions only' });
    }
    const isMember = sameId(room.host, req.user._id) || room.participants.some((p) => sameId(p, req.user._id)) || isAdmin(req.user);
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a participant of this room' });

    // Idempotent: one scorecard per user per room (retries return the existing one).
    const existing = await GDSession.findOne({ user: req.user._id, room: room._id }).lean();
    if (existing) {
      return res.json({
        success: true,
        evaluation: {
          overallScore: existing.scores.overall,
          communication: existing.scores.communication,
          contentQuality: existing.scores.contentQuality,
          leadership: existing.scores.leadership,
          teamwork: existing.scores.teamwork,
          reasoning: existing.scores.reasoning,
          strengths: existing.feedback.strengths,
          improvements: existing.feedback.improvements,
          detailedFeedback: existing.feedback.detailedFeedback,
          verdict: existing.feedback.verdict,
        },
        gdSessionId: existing._id,
        cached: true,
      });
    }

    const topic = String(req.body.topic || room.gdTopic || '').slice(0, 500);
    const part = req.body.participation || {};
    let spokenSeconds = Math.max(0, Math.round(Number(part.spokenSeconds) || 0));
    let turns = Math.max(0, Math.round(Number(part.turns) || 0));
    let spokePct = clampScore(part.spokePct);
    const transcriptText = typeof req.body.transcript === 'string' ? req.body.transcript.slice(0, MAX_TRANSCRIPT_CHARS).trim() : '';

    // Mic-contention guard: on some browsers the dictation mic grab can starve the
    // LiveKit publish, so a real speaker self-reports ~0 speaking time. If we DID
    // capture their words, the transcript is ground truth that they spoke — trust it
    // so a genuine participant is never mislabelled "silent" or penalized to zero.
    if (transcriptText) {
      const words = transcriptText.split(/\s+/).filter(Boolean).length;
      if (words >= 8) {
        spokenSeconds = Math.max(spokenSeconds, Math.round(words * 0.4)); // ~150 wpm
        turns = Math.max(turns, 1);
        spokePct = Math.max(spokePct, 15);
      }
    }

    let evaluation;
    let modelUsed = '';
    if (spokenSeconds < 10 && !transcriptText) {
      evaluation = silentScorecard();              // never spoke → guaranteed message
    } else if (!config.hasGroq()) {
      evaluation = heuristicScorecard({ spokenSeconds, turns, spokePct });
    } else {
      const { completion, modelUsed: used } = await evalCompletion({
        messages: [
          { role: 'system', content: 'You are an expert group-discussion evaluator for campus placements. Evaluate ONLY this one candidate, based strictly on what they actually said and how much they participated. Do not invent contributions.' },
          { role: 'user', content: `Topic: "${topic}".

This candidate's spoken contributions (auto-transcribed from their own microphone; may be partial or imperfect):
"""
${transcriptText || '(no transcript captured)'}
"""

Participation: spoke for ~${spokenSeconds}s across ${turns} speaking turn(s) — about ${spokePct}% of the group's total speaking time.

${rubricBlock()}

Weight participation heavily: a candidate who barely spoke CANNOT score well on communication, leadership, or teamwork regardless of transcript quality. If they spoke very little, say so plainly in the feedback.

Return ONLY valid JSON:
{
  "overallScore": (0-100),
  "communication": (0-100),
  "contentQuality": (0-100),
  "leadership": (0-100),
  "teamwork": (0-100),
  "reasoning": (0-100),
  "strengths": ["..."],
  "improvements": ["..."],
  "detailedFeedback": "2-3 paragraph evaluation addressed to the candidate",
  "verdict": "Excellent/Good/Average/Below Average"
}` },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });
      modelUsed = used;
      try {
        const raw = completion.choices[0]?.message?.content || '{}';
        evaluation = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      } catch {
        evaluation = { overallScore: 50, detailedFeedback: completion.choices[0]?.message?.content || '', verdict: 'Review needed' };
      }
    }

    let gdSessionId = null;
    try {
      const doc = await GDSession.create({
        user: req.user._id,
        room: room._id,
        topic,
        participation: { spokenSeconds, turns, spokePct },
        transcript: transcriptText ? [{ speaker: req.user.name, message: transcriptText }] : [],
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
        gradedBy: modelUsed,
      });
      gdSessionId = doc._id;
    } catch (e) { console.warn('GDSession (room) persist failed:', e.message); }

    res.json({ success: true, evaluation, gdSessionId });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// GET /api/gd-rooms/:id/my-result — the caller's own scorecard for this room.
router.get('/:id/my-result', protect, async (req, res) => {
  try {
    const session = await GDSession.findOne({ user: req.user._id, room: req.params.id }).lean();
    if (!session) return res.json({ success: true, session: null });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

module.exports = router;
