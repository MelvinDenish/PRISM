/**
 * Mentor webinars — a 1-to-many live session that CONSOLIDATES several pending
 * mentorship requests into one call. A "request" is just a MentorshipSession with
 * status 'pending', so a webinar is modelled as a GDRoom(mode:'webinar') whose
 * `invitedUsers` are the mentees of the chosen requests. Media + token gating reuse
 * the existing LiveKit path (routes/rtc.js already restricts webinar subscribe to
 * invitedUsers). History needs no new plumbing: ending the webinar marks each linked
 * MentorshipSession 'completed', and GET /api/mentorship already scopes by
 * mentor|mentee == req.user._id — so only the invited students ever see it.
 */
const express = require('express');
const GDRoom = require('../models/GDRoom');
const MentorshipSession = require('../models/MentorshipSession');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { genInviteCode } = require('../utils/gd');
const router = express.Router();

const sameId = (a, b) => String(a) === String(b);
const prodSafe = (error) => (process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message);

async function uniqueInviteCode() {
  for (let i = 0; i < 6; i++) {
    const code = genInviteCode();
    if (!(await GDRoom.exists({ inviteCode: code }))) return code;
  }
  return genInviteCode(8);
}

// POST /api/webinars — mentor consolidates their pending requests into one webinar.
// Body: { sessionIds: [String], agenda?: String }
router.post('/', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const sessionIds = Array.isArray(req.body.sessionIds) ? req.body.sessionIds : [];
    if (!sessionIds.length) {
      return res.status(400).json({ success: false, message: 'Select at least one request to consolidate' });
    }

    // Only this mentor's still-open requests can be pulled into the webinar.
    const sessions = await MentorshipSession.find({
      _id: { $in: sessionIds },
      mentor: req.user._id,
      status: { $in: ['pending', 'approved'] },
    });
    if (!sessions.length) {
      return res.status(400).json({ success: false, message: 'No eligible pending requests found for you' });
    }

    const invitedUsers = [...new Set(sessions.map((s) => String(s.mentee)))];
    const inviteCode = await uniqueInviteCode();
    const room = await GDRoom.create({
      mode: 'webinar',
      host: req.user._id,
      participants: [req.user._id],
      invitedUsers,
      inviteCode,
      maxParticipants: 100,
      gdTopic: String(req.body.agenda || '').slice(0, 300),
    });

    const meetingLink = `/gd-rooms?join=${inviteCode}`;
    await MentorshipSession.updateMany(
      { _id: { $in: sessions.map((s) => s._id) } },
      { webinar: room._id, status: 'approved', meetingLink },
    );

    // Best-effort: tell each invited student.
    await Promise.allSettled(invitedUsers.map((menteeId) => Notification.create({
      user: menteeId,
      type: 'session',
      message: `${req.user.name} is hosting a live webinar. Join with code ${inviteCode}.`,
    })));

    res.status(201).json({ success: true, room, inviteCode, meetingLink, invited: invitedUsers.length });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

// POST /api/webinars/:id/end — mentor ends the webinar; every linked request is
// completed (so it lands in each invited student's history) and the room closes.
router.post('/:id/end', protect, authorize('mentor', 'admin'), async (req, res) => {
  try {
    const room = await GDRoom.findById(req.params.id);
    if (!room || room.mode !== 'webinar') return res.status(404).json({ success: false, message: 'Webinar not found' });
    if (!sameId(room.host, req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the host can end this webinar' });
    }

    // Complete every linked request first — that's what each student keeps in their
    // history (GET /api/mentorship is per-user scoped, so only they see it).
    await MentorshipSession.updateMany(
      { webinar: room._id, status: { $ne: 'completed' } },
      { status: 'completed', completedAt: new Date() },
    );

    req.app.get('io')?.to(`gd-${room._id}`).emit('gd-ended', { message: '🔔 The webinar has ended.' });

    // The webinar room itself is ephemeral — delete it so it stops appearing in any
    // invited student's list. (Viewers don't self-evaluate, so nothing reads it after end.)
    await GDRoom.deleteOne({ _id: room._id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: prodSafe(error) });
  }
});

module.exports = router;
