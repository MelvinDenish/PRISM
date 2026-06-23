import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiUsers, FiPlay, FiFileText, FiTrendingUp } from 'react-icons/fi';
import { BrandMark } from './Brand';
import RefractedAscent from './RefractedAscent';

const ROTATING = [
    { icon: <FiUsers />, text: 'Get matched with mentors who landed the roles you want.' },
    { icon: <FiPlay />, text: 'Practice real interview rounds — aptitude, technical, HR.' },
    { icon: <FiFileText />, text: 'Sharpen your resume with instant, targeted analysis.' },
    { icon: <FiTrendingUp />, text: 'Track every topic, score and session as you improve.' },
];

const STATS = [
    { value: '6', label: 'Interview rounds' },
    { value: 'AI', label: 'Resume analysis' },
    { value: '1:1', label: 'Mentor sessions' },
];

/**
 * AuthLayout — split-screen auth shell.
 * Left: bold animated prism/aurora brand panel (rotating value props).
 * Right: the form card (passed as children). On narrow screens the panel
 * collapses and only the form shows. Respects reduced-motion.
 */
const AuthLayout = ({ children }) => {
    const reduce = useReducedMotion();
    const [i, setI] = useState(0);

    useEffect(() => {
        if (reduce) return;
        const id = setInterval(() => setI((p) => (p + 1) % ROTATING.length), 3600);
        return () => clearInterval(id);
    }, [reduce]);

    return (
        <div className="auth-shell">
            <aside className="auth-aside">
                <RefractedAscent variant="hero" />
                <div className="auth-aside-inner">
                    <div className="auth-aside-brand">
                        <BrandMark size={46} />
                        <span className="brand-wordmark" style={{ color: '#F6F1E7' }}>PRISM</span>
                    </div>

                    <div className="auth-aside-headline">
                        <h2>Refract your potential into a placement.</h2>
                        <p>Placement Resources &amp; Interview Skill Manager — your end-to-end prep, in one calm workspace.</p>
                    </div>

                    <div className="auth-rotator" aria-live="polite">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={i}
                                className="auth-rotator-item"
                                initial={reduce ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <span className="auth-rotator-icon">{ROTATING[i].icon}</span>
                                <span>{ROTATING[i].text}</span>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="auth-aside-stats">
                        {STATS.map((s) => (
                            <div key={s.label} className="auth-stat">
                                <div className="auth-stat-value">{s.value}</div>
                                <div className="auth-stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <div className="auth-panel">
                <div className="auth-card auth-card--panel">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
