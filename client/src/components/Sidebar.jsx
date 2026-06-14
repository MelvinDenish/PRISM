import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    FiHome, FiBook, FiUsers, FiCalendar,
    FiFileText, FiBarChart2, FiBell, FiLogOut, FiSettings, FiCode, FiBriefcase,
    FiMap, FiPlay, FiEdit, FiX, FiVideo, FiMessageSquare, FiRepeat, FiCpu, FiFolder, FiMic, FiDatabase
} from 'react-icons/fi';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

const Sidebar = ({ isOpen, collapsed, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleNavClick = () => {
        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 768 && onClose) onClose();
    };

    // Chat-first: the Copilot is pinned at the very top for every role; the
    // existing feature tabs remain below as secondary navigation.
    const copilotGroup = { items: [{ to: '/assistant', icon: <FiCpu />, label: 'PRISM Copilot' }] };

    const menteeNav = [
        copilotGroup,
        { items: [{ to: '/dashboard', icon: <FiHome />, label: 'Dashboard' }] },
        // Resources is intentionally NOT linked for mentees — Topics is the
        // framework above resources, and mentees consume resource content through
        // Topics / Learning Paths. The /resources route stays reachable (mentors
        // & admins link it under Content); it's just unlinked here, same pattern
        // as resume-analysis (P4).
        { label: 'Prepare', items: [
            { to: '/topics', icon: <FiBook />, label: 'Topics' },
            { to: '/learning-paths', icon: <FiMap />, label: 'Learning Paths' },
            { to: '/coding-questions', icon: <FiCode />, label: 'Coding Questions' },
            { to: '/interview-game', icon: <FiPlay />, label: 'Interview Game' },
            { to: '/behavioral-practice', icon: <FiMic />, label: 'Behavioral Practice' },
            { to: '/behavioral', icon: <FiMessageSquare />, label: 'STAR Bank' },
            { to: '/review', icon: <FiRepeat />, label: 'Review Queue' },
        ]},
        { label: 'Career', items: [
            { to: '/mentors', icon: <FiUsers />, label: 'Find Mentors' },
            { to: '/sessions', icon: <FiCalendar />, label: 'My Sessions' },
            { to: '/gd-rooms', icon: <FiVideo />, label: 'Group Discussion' },
            { to: '/companies', icon: <FiBriefcase />, label: 'Companies' },
        ]},
        // DOCUMENTS — agent-produced. My Resume is the repurposed resume canvas;
        // Files lists everything the Copilot generated. Resume Analysis moved into
        // the Copilot (analyze_resume tool), so it's no longer a tab here.
        { label: 'Documents', items: [
            { to: '/resume-builder', icon: <FiEdit />, label: 'My Resume' },
            { to: '/artifacts', icon: <FiFolder />, label: 'Files' },
        ]},
        { label: 'Activity', items: [
            { to: '/analytics', icon: <FiBarChart2 />, label: 'Analytics' },
            { to: '/notifications', icon: <FiBell />, label: 'Notifications' },
        ]},
    ];

    const mentorNav = [
        copilotGroup,
        { items: [{ to: '/dashboard', icon: <FiHome />, label: 'Dashboard' }] },
        { label: 'Mentorship', items: [
            { to: '/sessions', icon: <FiCalendar />, label: 'Sessions' },
            { to: '/gd-rooms', icon: <FiVideo />, label: 'Group Discussion' },
            { to: '/companies', icon: <FiBriefcase />, label: 'Companies' },
        ]},
        { label: 'Content', items: [
            { to: '/topics', icon: <FiBook />, label: 'Topics' },
            { to: '/resources', icon: <FiFileText />, label: 'Resources' },
            { to: '/coding-questions', icon: <FiCode />, label: 'Questions' },
            { to: '/question-bank', icon: <FiDatabase />, label: 'Question Bank' },
        ]},
        { label: 'Activity', items: [{ to: '/notifications', icon: <FiBell />, label: 'Notifications' }] },
    ];

    const adminNav = [
        copilotGroup,
        { items: [
            { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
            { to: '/admin', icon: <FiSettings />, label: 'Admin Panel' },
        ]},
        { label: 'Content', items: [
            { to: '/topics', icon: <FiBook />, label: 'Topics' },
            { to: '/resources', icon: <FiFileText />, label: 'Resources' },
            { to: '/companies', icon: <FiBriefcase />, label: 'Companies' },
            { to: '/question-bank', icon: <FiDatabase />, label: 'Question Bank' },
        ]},
        { label: 'Activity', items: [{ to: '/notifications', icon: <FiBell />, label: 'Notifications' }] },
    ];

    const nav = user?.role === 'admin' ? adminNav : user?.role === 'mentor' ? mentorNav : menteeNav;

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar-brand">
                <Brand size={30} />
                <button className="sidebar-close-btn" onClick={onClose}>
                    <FiX />
                </button>
            </div>

            <nav className="sidebar-nav">
                {nav.map((group, gi) => (
                    <div key={gi} className="nav-group">
                        {group.label && <span className="nav-group-label">{group.label}</span>}
                        {group.items.map((link) => (
                            <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <motion.span
                                                layoutId="nav-active-bar"
                                                className="nav-active-bar"
                                                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                                            />
                                        )}
                                        <span className="nav-icon">{link.icon}</span>
                                        <span className="nav-label">{link.label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <NavLink to="/profile" className="user-info" onClick={handleNavClick} style={{ textDecoration: 'none', color: 'inherit' }} title="View & edit your profile">
                    <div className="user-avatar">{user?.name?.[0] || 'U'}</div>
                    <div>
                        <div className="user-name">{user?.name}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                </NavLink>
                <div className="sidebar-footer-actions">
                    <ThemeToggle />
                    <button className="logout-btn" onClick={handleLogout} aria-label="Log out"><FiLogOut /></button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
