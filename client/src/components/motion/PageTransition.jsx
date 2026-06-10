import { motion, useReducedMotion } from 'framer-motion';

/**
 * PageTransition — clearly-visible enter for routed pages (no exit; enter-only
 * avoids the React Router <Outlet> exit sharp-edges). Slides up + fades + a touch
 * of scale with a spring settle so each navigation reads as a deliberate arrival.
 * Respects prefers-reduced-motion. Mount once around the <Outlet> in Layout.
 */
const PageTransition = ({ children }) => {
  const reduce = useReducedMotion();

  if (reduce) return children;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 1 }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
