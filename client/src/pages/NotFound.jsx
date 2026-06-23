import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { FiCompass, FiArrowLeft } from 'react-icons/fi';
import RefractedAscent from '../components/RefractedAscent';

const NotFound = () => {
    const navigate = useNavigate();
    const reduce = useReducedMotion();
    return (
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <RefractedAscent variant="hero" />
            <motion.div
                style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: 24 }}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <div style={{ fontSize: 56, marginBottom: 8, color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center' }}><FiCompass /></div>
                <h1 className="gradient-text" style={{ fontSize: 'clamp(64px, 12vw, 120px)', fontWeight: 800, lineHeight: 1, marginBottom: 12 }}>404</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 28, maxWidth: 420 }}>The page you're looking for doesn't exist or has been moved.</p>
                <button className="btn btn-action btn-lg" onClick={() => navigate('/')}><FiArrowLeft /> Go to Dashboard</button>
            </motion.div>
        </div>
    );
};

export default NotFound;
