import { motion, useReducedMotion } from 'framer-motion';
import AnimatedNumber from '../motion/AnimatedNumber';

/**
 * StatTile — standard metric card: icon + label + count-up value, optional
 * progress bar and sub-text. Replaces the repeated inline `.stat-card` blocks.
 *
 *   <StatTile icon={<FiBook />} label="Resources Done" value={12} suffix="/30" pct={40} />
 *   <StatTile icon={<FiPlay />} label="Games Played" value={8} accent="secondary" />
 */
const StatTile = ({
    icon,
    label,
    value,
    decimals = 0,
    prefix = '',
    suffix = '',
    pct,                 // optional 0–100 → renders a progress bar
    sub,                 // optional small caption under the value
    accent = 'primary',  // primary | secondary | success | warning | action | info
}) => {
    const reduce = useReducedMotion();
    const clamped = Math.max(0, Math.min(100, pct || 0));
    return (
        <div className="stat-card stat-tile spotlight">
            <div className="stat-tile-head">
                {icon && <span className={`stat-tile-icon accent-${accent}`}>{icon}</span>}
                <span className="stat-label">{label}</span>
            </div>
            <div className="stat-value">
                <AnimatedNumber value={Number(value) || 0} decimals={decimals} prefix={prefix} suffix={suffix} />
            </div>
            {sub && <div className="stat-tile-sub">{sub}</div>}
            {typeof pct === 'number' && (
                <div className="progress-bar" style={{ marginTop: 10 }}>
                    <motion.div
                        className="fill"
                        initial={reduce ? false : { width: 0 }}
                        whileInView={{ width: `${clamped}%` }}
                        viewport={{ once: true }}
                        transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.15 }}
                        style={reduce ? { width: `${clamped}%` } : undefined}
                    />
                </div>
            )}
        </div>
    );
};

export default StatTile;
