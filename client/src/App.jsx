import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import Mentors from './pages/Mentors';
import MentorProfile from './pages/MentorProfile';
import Sessions from './pages/Sessions';
import MockInterviews from './pages/MockInterviews';
import TechnicalInterview from './pages/TechnicalInterview';
import GDRooms from './pages/GDRooms';
import ResumeAnalysis from './pages/ResumeAnalysis';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Companies from './pages/Companies';
import CodingQuestions from './pages/CodingQuestions';
import Admin from './pages/Admin';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/interview/:id" element={<ProtectedRoute><TechnicalInterview /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="resources" element={<Resources />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="mentor/:id" element={<MentorProfile />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="mock-interviews" element={<MockInterviews />} />
            <Route path="gd-rooms" element={<GDRooms />} />
            <Route path="resume-analysis" element={<ResumeAnalysis />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="companies" element={<Companies />} />
            <Route path="coding-questions" element={<CodingQuestions />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
