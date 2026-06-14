/**
 * Resume design system — the single source of truth for what the renderer
 * supports and what the AI may emit. The server is authoritative: every
 * AI-produced design spec is run through validateDesign() before persistence.
 *
 * Spike scope: 2 layouts + web-safe font stacks (no font bundling yet, so the
 * Puppeteer PDF matches the browser preview with zero @font-face work). Curated
 * @fontsource pairs and more layouts arrive in the archetype-expansion phase.
 */

const LAYOUTS = ['single-column', 'sidebar-left'];
const DENSITIES = ['compact', 'normal', 'roomy'];
const HEADING_STYLES = ['underline', 'bar', 'caps', 'plain'];
const SECTION_KEYS = ['summary', 'experience', 'skills', 'projects', 'education'];

// Web-safe pairs for the spike (available in both Chromium and browsers).
const FONT_PAIRS = [
  { heading: 'Georgia, "Times New Roman", serif', body: 'Georgia, "Times New Roman", serif' },
  { heading: 'Helvetica, Arial, sans-serif', body: 'Helvetica, Arial, sans-serif' },
  { heading: 'Helvetica, Arial, sans-serif', body: 'Georgia, "Times New Roman", serif' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// Curated seed palettes keyed by a vibe word; buildPalette falls back to the
// first when a word is unknown. Extended in later phases; reuses the spirit of
// utils/themeGenerator.js (themeFromPrompt).
const SEED_PALETTES = {
  ocean:   { primary: '#0f766e', accent: '#f59e0b', text: '#15252b', muted: '#5b6b70', bg: '#ffffff', surface: '#f1f6f6' },
  slate:   { primary: '#1f2937', accent: '#2563eb', text: '#111827', muted: '#6b7280', bg: '#ffffff', surface: '#f4f5f7' },
  plum:    { primary: '#6d28d9', accent: '#db2777', text: '#1f1530', muted: '#6b6479', bg: '#ffffff', surface: '#f6f3fb' },
  forest:  { primary: '#166534', accent: '#ca8a04', text: '#13241a', muted: '#5c6b60', bg: '#ffffff', surface: '#f1f7f2' },
  ember:   { primary: '#b91c1c', accent: '#ea580c', text: '#2a1414', muted: '#6f5a57', bg: '#ffffff', surface: '#fbf3f1' },
};
const SEED_KEYS = Object.keys(SEED_PALETTES);

const DEFAULT_DESIGN = {
  layout: 'single-column',
  palette: { ...SEED_PALETTES.ocean },
  fonts: { ...FONT_PAIRS[0] },
  density: 'normal',
  headingStyle: 'underline',
  sectionOrder: [...SECTION_KEYS],
  hidden: [],
};

/** Pick/derive a 6-color palette from a vibe word (deterministic). */
function buildPalette(vibe) {
  const word = String(vibe || '').toLowerCase();
  const key = SEED_KEYS.find((k) => word.includes(k)) || SEED_KEYS[0];
  return { ...SEED_PALETTES[key] };
}

const oneOf = (val, list, fallback) => (list.includes(val) ? val : fallback);
const safeHex = (val, fallback) => (HEX.test(String(val || '')) ? val : fallback);

/** Clamp/repair an arbitrary (AI-produced) spec to a guaranteed-renderable one. */
function validateDesign(input) {
  const d = input && typeof input === 'object' ? input : {};
  const palIn = d.palette && typeof d.palette === 'object' ? d.palette : {};
  const fallbackPal = DEFAULT_DESIGN.palette;
  const palette = {
    primary: safeHex(palIn.primary, fallbackPal.primary),
    accent:  safeHex(palIn.accent,  fallbackPal.accent),
    text:    safeHex(palIn.text,    fallbackPal.text),
    muted:   safeHex(palIn.muted,   fallbackPal.muted),
    bg:      safeHex(palIn.bg,      fallbackPal.bg),
    surface: safeHex(palIn.surface, fallbackPal.surface),
  };
  const fontsIn = d.fonts && typeof d.fonts === 'object' ? d.fonts : {};
  const knownHeads = new Set(FONT_PAIRS.map((p) => p.heading));
  const knownBodies = new Set(FONT_PAIRS.map((p) => p.body));
  const fonts = {
    heading: knownHeads.has(fontsIn.heading) ? fontsIn.heading : DEFAULT_DESIGN.fonts.heading,
    body: knownBodies.has(fontsIn.body) ? fontsIn.body : DEFAULT_DESIGN.fonts.body,
  };
  const orderIn = Array.isArray(d.sectionOrder) ? d.sectionOrder : [];
  const filteredOrder = orderIn.filter((s) => SECTION_KEYS.includes(s));
  // Ensure every known section appears exactly once (missing ones appended).
  const sectionOrder = [...new Set(filteredOrder.concat(SECTION_KEYS))];
  const hidden = (Array.isArray(d.hidden) ? d.hidden : []).filter((s) => SECTION_KEYS.includes(s));
  return {
    layout: oneOf(d.layout, LAYOUTS, DEFAULT_DESIGN.layout),
    palette,
    fonts,
    density: oneOf(d.density, DENSITIES, DEFAULT_DESIGN.density),
    headingStyle: oneOf(d.headingStyle, HEADING_STYLES, DEFAULT_DESIGN.headingStyle),
    sectionOrder,
    hidden,
  };
}

/** Map a legacy `template` value to an equivalent design spec (read-time). */
function legacyTemplateToDesign(template) {
  switch (template) {
    case 'classic':
      return validateDesign({ layout: 'single-column', headingStyle: 'caps', palette: buildPalette('slate'), fonts: FONT_PAIRS[0] });
    case 'creative':
      return validateDesign({ layout: 'sidebar-left', headingStyle: 'bar', palette: buildPalette('ember'), fonts: FONT_PAIRS[1] });
    case 'modern':
    default:
      return validateDesign({ layout: 'single-column', headingStyle: 'underline', palette: buildPalette('ocean'), fonts: FONT_PAIRS[2] });
  }
}

/** Resolve the design for a draft: explicit design if present, else legacy map. */
function resolveDesign(draft) {
  if (draft && draft.design && draft.design.layout) return validateDesign(draft.design);
  return legacyTemplateToDesign(draft && draft.template);
}

/** Density → numeric spacing/scale used by both renderers. */
function densityScale(density) {
  switch (density) {
    case 'compact': return { gap: 12, pad: 36, font: 12.5 };
    case 'roomy':   return { gap: 22, pad: 52, font: 13.5 };
    case 'normal':
    default:        return { gap: 18, pad: 44, font: 13 };
  }
}

module.exports = {
  LAYOUTS, FONT_PAIRS, DENSITIES, HEADING_STYLES, SECTION_KEYS,
  SEED_KEYS, DEFAULT_DESIGN,
  buildPalette, validateDesign, legacyTemplateToDesign, resolveDesign, densityScale,
};
