import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import Mentors from './pages/Mentors';
import MentorProfile from './pages/MentorProfile';
import Sessions from './pages/Sessions';
import TechnicalInterview from './pages/TechnicalInterview';
import ResumeAnalysis from './pages/ResumeAnalysis';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Companies from './pages/Companies';
import CodingQuestions from './pages/CodingQuestions';
import Admin from './pages/Admin';
import Topics from './pages/Topics';
import InterviewGame from './pages/InterviewGame';
import ResumeBuilder from './pages/ResumeBuilder';
import LearningPaths from './pages/LearningPaths';
import NotFound from './pages/NotFound';
import VideoCall from './pages/VideoCall';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" />;
};

// Role-gated route: requires auth AND one of `roles`. Mirrors the server-side
// authorize() guard so the UI can't reach pages the API would reject (Phase 1).
const RoleRoute = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/interview/:id" element={<ProtectedRoute><TechnicalInterview /></ProtectedRoute>} />
          <Route path="/video-call/:sessionId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="topics" element={<Topics />} />
            <Route path="resources" element={<Resources />} />
            <Route path="learning-paths" element={<LearningPaths />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="mentor/:id" element={<MentorProfile />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="interview-game" element={<InterviewGame />} />
            <Route path="resume-builder" element={<ResumeBuilder />} />
            <Route path="resume-analysis" element={<ResumeAnalysis />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="companies" element={<Companies />} />
            <Route path="coding-questions" element={<CodingQuestions />} />
            <Route path="admin" element={<RoleRoute roles={['admin']}><Admin /></RoleRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
