import './AuroraBackground.css';

/**
 * AuroraBackground — fixed, GPU-cheap animated prism/aurora field behind the app.
 *
 * Pure CSS (transform/opacity only), theme-aware through the global CSS vars, and
 * fully disabled under prefers-reduced-motion. Two intensities:
 *   variant="app"  → subtle ambient wash for in-app pages (default)
 *   variant="hero" → bolder, for auth / landing first-impression surfaces
 *
 * Render once, high in the tree. It is pointer-events:none and sits at z-index 0.
 */
const AuroraBackground = ({ variant = 'app' }) => {
  return (
    <div className={`aurora aurora--${variant}`} aria-hidden="true">
      <span className="aurora__blob aurora__blob--teal" />
      <span className="aurora__blob aurora__blob--amber" />
      <span className="aurora__blob aurora__blob--sky" />
      <span className="aurora__grain" />
    </div>
  );
};

export default AuroraBackground;
