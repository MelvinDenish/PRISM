import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('prism_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Users
export const getProfile = () => api.get('/users/profile');
export const updateProfile = (data) => api.put('/users/profile', data);
export const getMentors = (params) => api.get('/users/mentors', { params });
export const getUserById = (id) => api.get(`/users/${id}`);
export const getAllUsers = () => api.get('/users');
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Companies
export const getCompanies = () => api.get('/companies');
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

// Mock Interviews
export const getMockInterviews = (params) => api.get('/mock-interviews', { params });
export const getMockInterview = (id) => api.get(`/mock-interviews/${id}`);
export const createMockInterview = (data) => api.post('/mock-interviews', data);
export const joinMockInterview = (id) => api.patch(`/mock-interviews/${id}/join`);
export const updateMockStatus = (id, data) => api.patch(`/mock-interviews/${id}/status`, data);

// Coding Questions
export const getCodingQuestions = (params) => api.get('/coding-questions', { params });
export const getCodingQuestion = (id) => api.get(`/coding-questions/${id}`);
export const createCodingQuestion = (data) => api.post('/coding-questions', data);

// Code Submissions
export const submitCode = (data) => api.post('/code-submissions', data);
export const getSubmissions = (interviewId) => api.get(`/code-submissions/interview/${interviewId}`);
export const getMySubmissions = () => api.get('/code-submissions/my');

// Mock Feedback
export const submitMockFeedback = (data) => api.post('/mock-feedback', data);
export const getInterviewFeedback = (id) => api.get(`/mock-feedback/interview/${id}`);
export const getUserFeedback = (userId) => api.get(`/mock-feedback/user/${userId}`);

// GD Rooms
export const getGDRooms = (params) => api.get('/gd-rooms', { params });
export const createGDRoom = (data) => api.post('/gd-rooms', data);
export const joinGDRoom = (id) => api.patch(`/gd-rooms/${id}/join`);
export const updateGDStatus = (id, data) => api.patch(`/gd-rooms/${id}/status`, data);

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

export default api;
