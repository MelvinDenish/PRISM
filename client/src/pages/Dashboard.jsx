import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MenteeDashboard from './MenteeDashboard';
import MentorDashboard from './MentorDashboard';

// Role router: each role gets a dashboard built for what they actually do.
// Mentee → progress/games/resources; Mentor → requests/sessions/mentees;
// Admin → the admin panel (no separate mentee-style dashboard).
const Dashboard = () => {
    const { user } = useAuth();
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'mentor') return <MentorDashboard />;
    return <MenteeDashboard />;
};

export default Dashboard;
