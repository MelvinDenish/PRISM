import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiBook, FiUsers, FiCalendar,
    FiFileText, FiBarChart2, FiBell, FiLogOut, FiSettings, FiCode, FiBriefcase,
    FiMap, FiPlay, FiEdit, FiX
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleNavClick = () => {
        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 768 && onClose) onClose();
    };

    const menteeLinks = [
        { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { to: '/topics', icon: <FiBook />, label: 'Topics' },
        { to: '/resources', icon: <FiFileText />, label: 'Resources' },
        { to: '/learning-paths', icon: <FiMap />, label: 'Learning Paths' },
        { to: '/mentors', icon: <FiUsers />, label: 'Find Mentors' },
        { to: '/sessions', icon: <FiCalendar />, label: 'My Sessions' },
        { to: '/interview-game', icon: <FiPlay />, label: 'Interview Game' },
        { to: '/resume-builder', icon: <FiEdit />, label: 'Resume Builder' },
        { to: '/resume-analysis', icon: <FiFileText />, label: 'Resume Analysis' },
        { to: '/coding-questions', icon: <FiCode />, label: 'Coding Questions' },
        { to: '/analytics', icon: <FiBarChart2 />, label: 'Analytics' },
        { to: '/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const mentorLinks = [
        { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { to: '/topics', icon: <FiBook />, label: 'Topics' },
        { to: '/resources', icon: <FiFileText />, label: 'Resources' },
        { to: '/sessions', icon: <FiCalendar />, label: 'Sessions' },
        { to: '/coding-questions', icon: <FiCode />, label: 'Questions' },
        { to: '/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const adminLinks = [
        { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
        { to: '/admin', icon: <FiSettings />, label: 'Admin Panel' },
        { to: '/topics', icon: <FiBook />, label: 'Topics' },
        { to: '/resources', icon: <FiFileText />, label: 'Resources' },
        { to: '/companies', icon: <FiBriefcase />, label: 'Companies' },
        { to: '/notifications', icon: <FiBell />, label: 'Notifications' },
    ];

    const links = user?.role === 'admin' ? adminLinks : user?.role === 'mentor' ? mentorLinks : menteeLinks;

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
            <div className="sidebar-brand">
                <div className="brand-icon">P</div>
                <span className="brand-text">PRISM</span>
                <button className="sidebar-close-btn" onClick={onClose}>
                    <FiX />
                </button>
            </div>

            <nav className="sidebar-nav">
                {links.map((link) => (
                    <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        <span className="nav-icon">{link.icon}</span>
                        <span className="nav-label">{link.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar">{user?.name?.[0] || 'U'}</div>
                    <div>
                        <div className="user-name">{user?.name}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                </div>
                <button className="logout-btn" onClick={handleLogout}><FiLogOut /></button>
            </div>
        </aside>
    );
};

export default Sidebar;
