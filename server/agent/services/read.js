/**
 * Read-only data services for the agentic assistant (Phase 1).
 *
 * These mirror the queries in the existing GET routes (users/mentors, topics,
 * resources, progress, companies/:id/track, mentorship) so the agent's read tools
 * and the HTTP API stay in lockstep. They take an explicit `userId`/`role` instead
 * of `req` so they can be called from the agent loop. Everything here is read-only:
 * no tool in this file mutates state.
 */

const User = require('../../models/User');
const Topic = require('../../models/Topic');
const Resource = require('../../models/Resource');
const Company = require('../../models/Company');
const CodingQuestion = require('../../models/CodingQuestion');
const CodeSubmission = require('../../models/CodeSubmission');
const Progress = require('../../models/Progress');
const MentorshipSession = require('../../models/MentorshipSession');
const Availability = require('../../models/Availability');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mirror of users.js PUBLIC_FIELDS, trimmed to what the agent needs to reason/cite.
const MENTOR_FIELDS = 'name role skills expertise currentCompany experienceLevel experience college rating totalReviews isOnline';

async function findMentors({ company, skill } = {}) {
  const filter = { role: 'mentor' };
  if (company) filter.currentCompany = new RegExp(escapeRegex(company), 'i');
  if (skill) filter.skills = { $in: [new RegExp(escapeRegex(skill), 'i')] };
  const mentors = await User.find(filter).select(MENTOR_FIELDS).limit(25).lean();
  return mentors.map((m) => ({
    id: String(m._id),
    name: m.name,
    currentCompany: m.currentCompany || '',
    skills: m.skills || [],
    experienceLevel: m.experienceLevel || '',
    rating: m.rating || 0,
    totalReviews: m.totalReviews || 0,
    isOnline: !!m.isOnline,
  }));
}

async function listTopics() {
  const topics = await Topic.find().select('name description').sort({ name: 1 }).lean();
  return topics.map((t) => ({ id: String(t._id), name: t.name, description: t.description || '' }));
}

async function listResources({ topicId, level, type, search } = {}) {
  const filter = {};
  if (topicId) filter.topic = topicId;
  if (level) filter.level = level;
  if (type) filter.resourceType = type;
  if (search) filter.title = new RegExp(escapeRegex(search), 'i');
  const resources = await Resource.find(filter)
    .populate('topic', 'name')
    .select('title description level resourceType link topic')
    .limit(40)
    .lean();
  return resources.map((r) => ({
    id: String(r._id),
    title: r.title,
    level: r.level,
    type: r.resourceType,
    topic: r.topic?.name || '',
    link: r.link || '',
  }));
}

async function listCompanies() {
  const companies = await Company.find().select('name description difficultyLevel').sort({ name: 1 }).lean();
  return companies.map((c) => ({ id: String(c._id), name: c.name, difficultyLevel: c.difficultyLevel || '' }));
}

// Mirror of companies.js GET /:id/track. `companyId` may be an id or a name.
async function getCompanyTrack({ userId, companyId, companyName }) {
  let company = null;
  if (companyId) company = await Company.findById(companyId).lean();
  if (!company && companyName) {
    company = await Company.findOne({ name: new RegExp(`^${escapeRegex(companyName)}$`, 'i') }).lean();
  }
  if (!company) return { found: false };

  const problems = await CodingQuestion.find({ companyTags: company._id })
    .select('title difficulty verified testCases topic')
    .populate('topic', 'name')
    .sort({ difficulty: 1 })
    .lean();

  const solvedIds = await CodeSubmission.distinct('question', { user: userId, passed: true });
  const solvedSet = new Set(solvedIds.map(String));
  const problemsOut = problems.map((p) => ({
    id: String(p._id),
    title: p.title,
    difficulty: p.difficulty,
    topic: p.topic?.name,
    solved: solvedSet.has(String(p._id)),
  }));

  return {
    found: true,
    company: {
      id: String(company._id),
      name: company.name,
      description: company.description || '',
      interviewPattern: company.interviewPattern || '',
      difficultyLevel: company.difficultyLevel || '',
    },
    problems: problemsOut,
    solvedCount: problemsOut.filter((p) => p.solved).length,
    totalCount: problemsOut.length,
  };
}

async function getMyProgress({ userId }) {
  const progress = await Progress.findOne({ mentee: userId })
    .populate('topicProgress.topic', 'name')
    .lean();
  if (!progress) {
    return { completedResources: 0, topicProgress: [], mockInterviewStats: {} };
  }
  return {
    completedResources: (progress.completedResources || []).length,
    topicProgress: (progress.topicProgress || []).map((tp) => ({
      topic: tp.topic?.name || '',
      percentage: tp.percentage || 0,
    })),
    mockInterviewStats: progress.mockInterviewStats || {},
  };
}

async function getMySessions({ userId, role }) {
  const filter = role === 'mentor' ? { mentor: userId } : { mentee: userId };
  const sessions = await MentorshipSession.find(filter)
    .populate('mentor', 'name currentCompany')
    .populate('mentee', 'name')
    .select('status scheduledDate duration agenda mentor mentee')
    .sort({ scheduledDate: -1 })
    .limit(20)
    .lean();
  return sessions.map((s) => ({
    id: String(s._id),
    status: s.status,
    scheduledDate: s.scheduledDate,
    durationMinutes: s.duration,
    agenda: s.agenda,
    mentor: s.mentor?.name || '',
    mentorCompany: s.mentor?.currentCompany || '',
    mentee: s.mentee?.name || '',
  }));
}

async function getMentorAvailability({ mentorId }) {
  const av = await Availability.findOne({ mentor: mentorId }).lean();
  if (!av) return { weeklySlots: [], openSlots: [] };
  const now = Date.now();
  return {
    weeklySlots: (av.weeklySlots || [])
      .filter((s) => s.isAvailable !== false)
      .map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime })),
    // Future, not-yet-booked specific-date slots only.
    openSlots: (av.availableSlots || [])
      .filter((s) => !s.isBooked && s.date && new Date(s.date).getTime() > now)
      .map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime })),
    timezone: av.timezone || 'Asia/Kolkata',
  };
}

module.exports = {
  findMentors,
  listTopics,
  listResources,
  listCompanies,
  getCompanyTrack,
  getMyProgress,
  getMySessions,
  getMentorAvailability,
};
