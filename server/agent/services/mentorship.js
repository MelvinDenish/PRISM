/**
 * Shared mentorship-booking service.
 *
 * Extracted from routes/mentorship.js POST / so the HTTP route AND the assistant's
 * book_mentorship_session confirm-executor enforce the SAME rules: required fields,
 * future date, no self-booking, and true interval-overlap protection. Side effects
 * (in-app notification + mentor email with the /sessions deep-link) live here too.
 *
 * Errors carry a `statusCode` so callers can map them to HTTP status / chat messages.
 */

const MentorshipSession = require('../../models/MentorshipSession');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { sendSessionRequestEmail } = require('../../utils/emailService');

function fail(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

/**
 * Validate + create a mentorship session, then notify the mentor.
 * @param {object} p
 * @param {string} p.menteeId        the booking mentee (req.user._id)
 * @param {string} p.menteeName      for the notification/email
 * @param {string} p.mentorId
 * @param {string|Date} p.scheduledDate
 * @param {number} [p.duration=60]   minutes
 * @param {string} p.agenda
 * @param {string} [p.aimingCompany] Company id (optional)
 * @param {boolean} [p.awaitEmail=false] await the email send and report status
 *        (the HTTP route stays fire-and-forget to keep its response fast; the
 *        assistant confirm flow awaits so it can tell the user the mentor was emailed)
 * @returns {Promise<{ session: object, emailed: boolean|null }>}
 */
async function bookSession({ menteeId, menteeName, mentorId, scheduledDate, duration, agenda, aimingCompany, awaitEmail = false }) {
  if (!mentorId || !scheduledDate || !agenda) {
    throw fail(400, 'Mentor, scheduled date, and agenda are required');
  }

  const schedDate = new Date(scheduledDate);
  if (Number.isNaN(schedDate.getTime()) || schedDate <= new Date()) {
    throw fail(400, 'Cannot book a session in the past');
  }
  if (String(mentorId) === String(menteeId)) {
    throw fail(400, 'Cannot book a session with yourself');
  }

  // Confirm the target is actually a mentor (the agent resolves ids from find_mentors,
  // but re-check on the authoritative write path).
  const mentorUser = await User.findById(mentorId).select('name email role');
  if (!mentorUser || mentorUser.role !== 'mentor') {
    throw fail(404, 'Mentor not found');
  }

  // True interval-overlap protection against double-booking (mirror of the route).
  const sessionDuration = duration || 60;
  const sessionEnd = new Date(schedDate.getTime() + sessionDuration * 60000);
  const activeSessions = await MentorshipSession.find({
    mentor: mentorId,
    status: { $in: ['pending', 'approved', 'in-progress'] },
    scheduledDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  }).select('scheduledDate duration');

  const overlaps = activeSessions.some((s) => {
    const existStart = new Date(s.scheduledDate).getTime();
    const existEnd = existStart + (s.duration || 60) * 60000;
    return existStart < sessionEnd.getTime() && existEnd > schedDate.getTime();
  });
  if (overlaps) {
    throw fail(409, 'Mentor has a conflicting session at that time. Please choose another slot.');
  }

  const session = await MentorshipSession.create({
    mentor: mentorId,
    mentee: menteeId,
    scheduledDate: schedDate,
    duration: sessionDuration,
    agenda,
    aimingCompany: aimingCompany || undefined,
  });

  await Notification.create({
    user: mentorId,
    type: 'session',
    message: `New mentorship session request from ${menteeName}`,
  });

  // Email the mentor (deep-links to /sessions where they log in and approve via
  // the existing PATCH /mentorship/:id/status). Never let email failure fail booking.
  let emailed = null;
  if (mentorUser.email) {
    const sendPromise = sendSessionRequestEmail(mentorUser.email, mentorUser.name, {
      name: menteeName,
      agenda,
      scheduledDate: schedDate,
      durationMinutes: sessionDuration,
    }).then((r) => r?.success ?? false).catch((err) => { console.error('Email send error:', err); return false; });

    if (awaitEmail) emailed = await sendPromise;
  }

  return { session, emailed };
}

module.exports = { bookSession };
