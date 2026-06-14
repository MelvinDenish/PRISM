import { motion, useReducedMotion } from 'framer-motion';

/**
 * PageHero — slim, premium top-of-page identity that visibly assembles on load:
 * the icon, eyebrow, title, subtitle and actions spring in with a short stagger.
 *
 *   <PageHero eyebrow="Prepare" title="Topics" subtitle="Master every area"
 *             icon={<FiBook />} actions={<button className="btn btn-action">New</button>} />
 */
const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

const PageHero = ({ eyebrow, title, subtitle, icon, actions, align = 'left' }) => {
    const reduce = useReducedMotion();

    const MaybeMotion = reduce ? 'div' : motion.div;
    const childProps = reduce ? {} : { variants: item };
    const rootProps = reduce
        ? {}
        : { variants: container, initial: 'hidden', animate: 'show' };

    return (
        <MaybeMotion className={`page-hero page-hero--${align}`} {...rootProps}>
            <div className="page-hero-row">
                <div className="page-hero-main">
                    {icon && <MaybeMotion className="page-hero-icon" {...childProps}>{icon}</MaybeMotion>}
                    <div>
                        {eyebrow && <MaybeMotion className="page-hero-eyebrow" {...childProps}>{eyebrow}</MaybeMotion>}
                        <MaybeMotion className="page-hero-title" {...childProps}><span className="gradient-text">{title}</span></MaybeMotion>
                        {subtitle && <MaybeMotion className="page-hero-sub" {...childProps}>{subtitle}</MaybeMotion>}
                    </div>
                </div>
                {actions && <MaybeMotion className="page-hero-actions" {...childProps}>{actions}</MaybeMotion>}
            </div>
        </MaybeMotion>
    );
};

export default PageHero;
