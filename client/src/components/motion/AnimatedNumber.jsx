import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * AnimatedNumber — eased count-up to `value`.
 *
 * Renders a span with tabular-nums so the layout never shifts as digits change.
 * Respects prefers-reduced-motion (shows the final value immediately). Re-runs
 * smoothly when `value` changes (animates from the previous value).
 *
 *   <AnimatedNumber value={82} suffix="%" />
 *   <AnimatedNumber value={1240} decimals={0} duration={1.1} />
 */
const AnimatedNumber = ({
  value = 0,
  duration = 1.3,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  style,
}) => {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduce ? value : 0));
  const fromRef = useRef(reduce ? value : 0);
  const rafRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;

    if (reduce) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    const ms = Math.max(duration, 0.01) * 1000;
    // easeOutCubic
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min((now - start) / ms, 1);
      const current = from + (target - from) * ease(t);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduce]);

  const formatted = Number(display).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{formatted}{suffix}
    </span>
  );
};

export default AnimatedNumber;
