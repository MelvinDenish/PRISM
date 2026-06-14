import { motion, useReducedMotion } from 'framer-motion';

/**
 * Reveal — clearly-visible, spring-physics entrance as elements scroll into view.
 *
 * Larger travel + scale + spring settle so the motion actually reads. Stagger via
 * `i` (list index) cascades grids in. Respects prefers-reduced-motion (instant).
 * Do NOT wrap imperative surfaces that must not remount (Monaco, live video/socket).
 *
 *   <Reveal>                 fades/springs up
 *   <Reveal i={index}>       staggered by list index
 *   <Reveal hover>           adds a lift-on-hover (gold glow handled by .spotlight/.card)
 */
const Reveal = ({
  children,
  as = 'div',
  delay = 0,
  i,                 // optional list index → auto-staggered delay
  y = 34,
  hover = false,
  className,
  style,
  once = true,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  const computedDelay = typeof i === 'number' ? delay + Math.min(i, 14) * 0.09 : delay;

  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className} style={style} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      style={style}
      initial={{ opacity: 0, y, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={hover ? { y: -6 } : undefined}
      viewport={{ once, amount: 0.15, margin: '0px 0px -50px 0px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 16, mass: 0.9, delay: computedDelay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

export default Reveal;
