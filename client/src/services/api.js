import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('prism_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle expired JWT — redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/login') {
            localStorage.removeItem('prism_token');
            window.location.href = '/login?expired=1';
        }
        return Promise.reject(error);
    }
);

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password });

// Users
export const getProfile = () => api.get('/users/profile');
export const updateProfile = (data) => api.put('/users/profile', data);
// Self-edit identity + academics (Phase 1 Profile page). Whitelisted server-side.
export const updateMe = (data) => api.put('/users/me', data);
export const getMentors = (params) => api.get('/users/mentors', { params });
export const getUserById = (id) => api.get(`/users/${id}`);
export const getAllUsers = () => api.get('/users');
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Companies
export const getCompanies = () => api.get('/companies');
// Caller's eligibility per company (Phase 1) — { [companyId]: { eligible, unknown, reasons } }.
export const getMyEligibility = () => api.get('/companies/eligibility');
export const getCompanyTrack = (id) => api.get(`/companies/${id}/track`);
export const createCompany = (data) => api.post('/companies', data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);
export const deleteCompany = (id) => api.delete(`/companies/${id}`);

// Topics
export const getTopics = () => api.get('/topics');
export const createTopic = (data) => api.post('/topics', data);
export const updateTopic = (id, data) => api.put(`/topics/${id}`, data);
export const deleteTopic = (id) => api.delete(`/topics/${id}`);

// Resources
export const getResources = (params) => api.get('/resources', { params });
export const getResource = (id) => api.get(`/resources/${id}`);
export const createResource = (data) => api.post('/resources', data);
export const getResourceReader = (url) => api.get('/resources/reader', { params: { url } });
export const updateResource = (id, data) => api.put(`/resources/${id}`, data);
export const deleteResource = (id) => api.delete(`/resources/${id}`);

// Progress
export const getProgress = () => api.get('/progress');
export const completeResource = (id) => api.patch(`/progress/complete/${id}`);
export const uncompleteResource = (id) => api.patch(`/progress/uncomplete/${id}`);
export const getProgressStats = () => api.get('/progress/stats');

// Mentorship
export const bookSession = (data) => api.post('/mentorship', data);
export const getSessions = (params) => api.get('/mentorship', { params });
export const updateSessionStatus = (id, data) => api.patch(`/mentorship/${id}/status`, data);
export const rateSession = (id, data) => api.patch(`/mentorship/${id}/rate`, data);

// Availability
export const getAvailability = (mentorId) => api.get(`/availability/${mentorId}`);
export const setAvailability = (data) => api.post('/availability', data);



// Coding Questions
export const getCodingQuestions = (params) => api.get('/coding-questions', { params });
export const getCodingQuestion = (id) => api.get(`/coding-questions/${id}`);
export const createCodingQuestion = (data) => api.post('/coding-questions', data);
export const submitCodingSolution = (id, data) => api.post(`/coding-questions/${id}/submit`, data);
export const getCodingProgress = () => api.get('/coding-questions/progress');
export const getCodingSubmissions = (id) => api.get(`/coding-questions/${id}/submissions`);





// Resume Analysis
export const analyzeResume = (data) => api.post('/resume-analysis', data);
export const getAnalysisHistory = () => api.get('/resume-analysis');
export const getAnalysis = (id) => api.get(`/resume-analysis/${id}`);

// Analytics
export const getDashboardAnalytics = () => api.get('/analytics/dashboard');

// Notifications
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');

// =================== NEW APIs ===================

// Interview Game
export const startInterviewGame = (data) => api.post('/interview-game/start', data);
export const getGameQuestions = (round, gameId, difficulty) => api.get(`/interview-game/questions/${round}`, { params: { gameId, difficulty } });
export const submitGameRound = (data) => api.post('/interview-game/submit-round', data);
export const getGameHistory = () => api.get('/interview-game/history');
export const getGame = (id) => api.get(`/interview-game/${id}`);
export const getGameReport = (id) => api.get(`/interview-game/${id}/report`);
export const getLeaderboard = () => api.get('/interview-game/leaderboard/top');

// Mentor/admin company-tagged Question Bank (Phase 3 hybrid game)
export const getBankQuestions = (params) => api.get('/question-bank', { params });
export const addBankQuestion = (data) => api.post('/question-bank', data);
export const updateBankQuestion = (id, data) => api.put(`/question-bank/${id}`, data);
export const deleteBankQuestion = (id) => api.delete(`/question-bank/${id}`);


// AI Interview (used by InterviewGame & TechnicalInterview)
export const startAIInterview = (data) => api.post('/ai-interview/start', data);
export const chatAIInterview = (data) => api.post('/ai-interview/chat', data);
export const evaluateAIInterview = (data) => api.post('/ai-interview/evaluate', data);

// Summarize
export const summarizeArticle = (data) => api.post('/summarize', data);



// Resume Builder
export const getResumeDesignSystem = () => api.get('/resume-builder/design-system');
// Gap-aware intake: client holds `collected` and echoes it back each turn so the
// server can merge the per-turn delta and re-score the completeness gate.
export const resumeIntake = (messages, collected) => api.post('/resume-builder/intake', { messages, collected });
// "Fill a page for me" assist. draftResumeContent: AI expands the user's project
// briefs (grounded) → { draftedProjects }. applyResumeContent: folds the user's
// EDITED projects back through the gate → { collected, assessment }.
export const draftResumeContent = (collected) => api.post('/resume-builder/draft-content', { collected });
export const applyResumeContent = (collected, projects) => api.post('/resume-builder/draft-content', { collected, apply: true, projects });
// AI-authored resume (Generative Resume). authorResume: lazy path sends {} (drafts
// from profile) or { collected } (confirmed chat content); optional { instruction }.
export const authorResume = (data) => api.post('/resume-builder/author', data || {});
export const regenerateResume = (id, instruction) => api.post(`/resume-builder/drafts/${id}/regenerate`, instruction ? { instruction } : {});
export const getResumeDrafts = () => api.get('/resume-builder/drafts');
export const getResumeDraft = (id) => api.get(`/resume-builder/drafts/${id}`);
export const saveResumeDraft = (data) => api.post('/resume-builder/drafts', data);
export const updateResumeDraft = (id, data) => api.put(`/resume-builder/drafts/${id}`, data);
export const deleteResumeDraft = (id) => api.delete(`/resume-builder/drafts/${id}`);
export const generateResumeContent = (data) => api.post('/resume-builder/generate', data);
export const generateCoverLetter = (data) => api.post('/resume-builder/cover-letter', data);
// Resume Canvas (Copilot P3) — agent-driven flow on top of ResumeDraft
export const generateResumeDraft = (data) => api.post('/resume-builder/drafts/generate', data || {});
export const refineResumeDraft = (id, instruction) => api.post(`/resume-builder/drafts/${id}/refine`, { instruction });
export const exportResumeDraft = (id, format) => api.post(`/resume-builder/drafts/${id}/export`, { format });
// Resume Canvas (P7) — click-to-edit, JD tailoring + gaps, ATS chip, revisions
export const editResumeSection = (id, path, value) => api.patch(`/resume-builder/drafts/${id}/section`, { path, value });
export const tailorResumeDraft = (id, data) => api.post(`/resume-builder/drafts/${id}/tailor`, data);
export const atsCheckResumeDraft = (id) => api.post(`/resume-builder/drafts/${id}/ats`);
export const getResumeRevisions = (id) => api.get(`/resume-builder/drafts/${id}/revisions`);
export const restoreResumeRevision = (id, revId) => api.post(`/resume-builder/drafts/${id}/revisions/${revId}/restore`);

// Learning Paths
export const submitOnboarding = (data) => api.put('/auth/onboarding', data);
export const getBehavioralAnswers = () => api.get('/behavioral');
export const createBehavioralAnswer = (data) => api.post('/behavioral', data);
export const updateBehavioralAnswer = (id, data) => api.put(`/behavioral/${id}`, data);
export const deleteBehavioralAnswer = (id) => api.delete(`/behavioral/${id}`);

// Behavioral Practice (answer → AI score + feedback; parallel to the STAR Bank)
export const getBehavioralQuestions = (count) => api.get('/behavioral-practice/questions', { params: count ? { count } : {} });
export const evaluateBehavioralAnswer = (data) => api.post('/behavioral-practice/evaluate', data);

// Review Queue (C3 — spaced repetition)
export const getReviewQueue = () => api.get('/review/queue');
export const getReviewStats = () => api.get('/review/stats');
export const gradeReviewItem = (id, remembered) => api.post(`/review/${id}/review`, { remembered });
export const dismissReviewItem = (id) => api.delete(`/review/${id}`);
export const getLearningPaths = () => api.get('/learning-paths');
export const getLearningPath = (id) => api.get(`/learning-paths/${id}`);
export const generateLearningPath = (data) => api.post('/learning-paths/generate', data);
export const updatePathProgress = (id, data) => api.patch(`/learning-paths/${id}/progress`, data);
export const deleteLearningPath = (id) => api.delete(`/learning-paths/${id}`);
// Phase 2 — learning-path final test + certificate
export const generatePathTest = (id) => api.post(`/learning-paths/${id}/test/generate`);
export const getPathTest = (id) => api.get(`/learning-paths/${id}/test`);
export const submitPathTest = (id, answers) => api.post(`/learning-paths/${id}/test/submit`, { answers });
export const verifyCertificate = (certId) => api.get(`/learning-paths/certificate/${certId}`);

// Code Execution (Piston)
export const submitCodeExecution = (data) => api.post('/code-execution/submit', data);
export const runTestCases = (data) => api.post('/code-execution/run-tests', data);
export const runCustomCode = (data) => api.post('/code-execution/run-custom', data);
export const getJudgeLanguages = () => api.get('/code-execution/languages');

// Group Discussion
export const startGroupDiscussion = (data) => api.post('/group-discussion/start', data || {});
export const respondGroupDiscussion = (data) => api.post('/group-discussion/respond', data);
export const evaluateGroupDiscussion = (data) => api.post('/group-discussion/evaluate', data);
export const getGDHistory = () => api.get('/group-discussion/history');

// GD Rooms (live, multi-participant video via LiveKit). Rooms are private:
// listing returns only YOUR rooms; others join with the invite code.
export const getGDRooms = (params) => api.get('/gd-rooms', { params });
export const getGDRoom = (id) => api.get(`/gd-rooms/${id}`);
export const createGDRoom = (data) => api.post('/gd-rooms', data || {});
export const joinGDRoomByCode = (code) => api.post('/gd-rooms/join-by-code', { code });
export const joinGDRoom = (id) => api.patch(`/gd-rooms/${id}/join`);
export const startGDRoom = (id, data) => api.post(`/gd-rooms/${id}/start`, data || {});
export const endGDRoom = (id) => api.post(`/gd-rooms/${id}/end`);
export const evaluateGDRoom = (id, data) => api.post(`/gd-rooms/${id}/evaluate`, data || {});
export const getGDRoomResult = (id) => api.get(`/gd-rooms/${id}/my-result`);

// Webinars (mentor 1-to-many; consolidates pending mentorship requests)
export const createWebinar = (data) => api.post('/webinars', data);
export const endWebinar = (id) => api.post(`/webinars/${id}/end`);

// Live video (LiveKit SFU) — mint a room-scoped access token.
// roomName is "session:<sessionId>" (1:1) or "gd:<roomId>" (group/webinar).
export const getRtcToken = (roomName) => api.post('/rtc/token', { roomName });

// Agentic assistant ("PRISM Copilot")
// Persistent path: sendAssistantMessage({ conversationId?, message })
// Legacy stateless path still works if caller passes { messages } array directly.
export const sendAssistantMessage = ({ conversationId, message } = {}) =>
  api.post('/assistant/chat', { conversationId, message });

// Streaming path: POST /assistant/chat/stream over SSE, read with fetch (native
// EventSource can't attach the Bearer header). Invokes onEvent for each frame
// ({ type: conversation|tool|token|reset|done|error }). Pass an AbortSignal to
// cancel (e.g. the user switched conversations mid-stream). Resolves when the
// stream ends; rejects only if the request never starts (network / non-2xx),
// so callers can fall back to the non-streaming endpoint.
export async function streamAssistantMessage({ conversationId, message }, { onEvent, signal } = {}) {
  const token = localStorage.getItem('prism_token');
  const res = await fetch(`${API_URL}/assistant/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ conversationId, message }),
    signal,
  });

  if (res.status === 401) {
    localStorage.removeItem('prism_token');
    if (window.location.pathname !== '/login') window.location.href = '/login?expired=1';
    const e = new Error('Session expired'); e.status = 401; throw e;
  }

  // Non-streaming failure (429/503/500 return JSON before any SSE frame).
  if (!res.ok || !res.body) {
    let msg;
    try { msg = (await res.json())?.message; } catch { /* ignore */ }
    const e = new Error(msg || 'The assistant is unavailable right now.');
    e.status = res.status;
    throw e;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      let ev;
      try { ev = JSON.parse(data); } catch { continue; }
      onEvent?.(ev);
    }
  }
}
export const confirmAssistantAction = (proposedAction, conversationId) =>
  api.post('/assistant/confirm', { proposedAction, ...(conversationId ? { conversationId } : {}) });
export const listConversations = () => api.get('/assistant/conversations');
export const getConversation = (id) => api.get(`/assistant/conversations/${id}`);
export const deleteConversation = (id) => api.delete(`/assistant/conversations/${id}`);

// Artifacts (generated downloadable files)
export const listArtifacts = () => api.get('/artifacts');
export const deleteArtifact = (id) => api.delete(`/artifacts/${id}`);

/**
 * Download an artifact as a blob and trigger a browser save-file dialog.
 * Uses fetch+Authorization so the JWT is sent (never puts the token in the URL).
 * @param {string} id   Artifact document _id
 * @param {string} filename  Suggested filename for the download
 */
export const downloadArtifact = async (id, filename = 'document') => {
  const token = localStorage.getItem('prism_token');
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  const response = await fetch(`${baseUrl}/api/artifacts/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

// ── Prep profile / readiness spine (P6) ──
export const getPrepProfile = () => api.get('/prep-profile');
export const updatePrepProfile = (data) => api.put('/prep-profile', data);
export const refreshDailyPlan = () => api.post('/prep-profile/plan/refresh');
export const toggleDailyPlanItem = (itemId) => api.post(`/prep-profile/plan/${itemId}/done`);

export default api;
