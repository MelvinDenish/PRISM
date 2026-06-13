// Client mirror of the server design tokens used for rendering. Display lists
// come from the /design-system endpoint at runtime; these helpers are the pure
// token→style math shared in spirit with server/agent/services/resumeDesign.js.

export const SECTION_KEYS = ['summary', 'experience', 'skills', 'projects', 'education'];

export const DEFAULT_DESIGN = {
  layout: 'single-column',
  palette: { primary: '#0f766e', accent: '#f59e0b', text: '#15252b', muted: '#5b6b70', bg: '#ffffff', surface: '#f1f6f6' },
  fonts: { heading: 'Helvetica, Arial, sans-serif', body: 'Georgia, "Times New Roman", serif' },
  density: 'normal',
  headingStyle: 'underline',
  sectionOrder: [...SECTION_KEYS],
  hidden: [],
};

export function densityScale(density) {
  switch (density) {
    case 'compact': return { gap: 12, pad: 36, font: 12.5 };
    case 'roomy':   return { gap: 22, pad: 52, font: 13.5 };
    default:        return { gap: 18, pad: 44, font: 13 };
  }
}

// Heading style → CSS for a section <h3>, given the accent color.
export function headingStyleCss(headingStyle, accent) {
  const base = { color: accent, fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'none', letterSpacing: 0, borderBottom: 'none', paddingBottom: 0 };
  switch (headingStyle) {
    case 'caps':      return { ...base, textTransform: 'uppercase', letterSpacing: 1.5 };
    case 'bar':       return { ...base, borderLeft: `4px solid ${accent}`, paddingLeft: 8 };
    case 'plain':     return base;
    case 'underline':
    default:          return { ...base, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `1px solid ${accent}33`, paddingBottom: 4 };
  }
}
