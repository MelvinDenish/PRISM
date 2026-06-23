import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import RefractedAscent from './RefractedAscent';
import PageTransition from './motion/PageTransition';
import { FiMenu, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem('prism_sidebar') === 'collapsed'
    ); // desktop collapse
    const location = useLocation();

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('prism_sidebar', next ? 'collapsed' : 'open');
            return next;
        });
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <RefractedAscent variant="app" />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            <Sidebar
                isOpen={sidebarOpen}
                collapsed={collapsed}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Desktop collapse toggle — same button hides the sidebar to the
                side and brings it back. Sits just outside the sidebar edge. */}
            <button
                className={`sidebar-toggle ${collapsed ? 'collapsed' : ''}`}
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
                title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
                {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
            </button>

            <main className={`main-content ${collapsed ? 'main-content--expanded' : ''}`}>
                {/* Mobile hamburger */}
                <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                    <FiMenu />
                </button>
                {/* Keyed by path so each navigation replays the gentle enter transition */}
                <PageTransition key={location.pathname}>
                    <Outlet />
                </PageTransition>
            </main>
        </div>
    );
};

export default Layout;
