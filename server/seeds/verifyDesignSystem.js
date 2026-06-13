/* Headless verification for the resume design system. Run: node server/seeds/verifyDesignSystem.js */
const assert = require('assert');
const {
  LAYOUTS, FONT_PAIRS, DENSITIES, HEADING_STYLES, SECTION_KEYS,
  DEFAULT_DESIGN, buildPalette, validateDesign, legacyTemplateToDesign,
} = require('../agent/services/resumeDesign');

let passed = 0;
const ok = (label) => { passed += 1; console.log('  ok -', label); };

// Catalog sanity
assert(LAYOUTS.includes('single-column') && LAYOUTS.includes('sidebar-left'), 'core layouts present');
assert(FONT_PAIRS.length >= 2, 'at least two font pairs'); ok('catalog');

// buildPalette: returns 6 valid hex colors with readable text/bg contrast
const pal = buildPalette('ocean');
const hex = /^#[0-9a-fA-F]{6}$/;
for (const k of ['primary', 'accent', 'text', 'muted', 'bg', 'surface']) {
  assert(hex.test(pal[k]), `palette.${k} is a hex color`);
}
// text on bg must have a decent luminance gap (cheap contrast proxy)
const lum = (h) => { const n = parseInt(h.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
assert(Math.abs(lum(pal.text) - lum(pal.bg)) > 0.4, 'text/bg contrast'); ok('buildPalette');

// validateDesign repairs junk → always a renderable spec
const repaired = validateDesign({
  layout: 'bogus-layout', density: 'huge', headingStyle: 'sparkles',
  palette: { primary: 'not-a-color', text: '#111111' },
  fonts: { heading: 'Comic Sans MS', body: '' },
  sectionOrder: ['summary', 'nonsense', 'skills'],
  hidden: ['education', 'nope'],
});
assert(LAYOUTS.includes(repaired.layout), 'bad layout repaired to a known one');
assert(DENSITIES.includes(repaired.density), 'bad density repaired');
assert(HEADING_STYLES.includes(repaired.headingStyle), 'bad headingStyle repaired');
assert(hex.test(repaired.palette.primary), 'bad hex repaired');
assert(repaired.sectionOrder.every((s) => SECTION_KEYS.includes(s)), 'sectionOrder filtered to known keys');
assert(repaired.hidden.every((s) => SECTION_KEYS.includes(s)), 'hidden filtered to known keys');
ok('validateDesign repairs junk');

// validateDesign keeps a good spec intact
const good = validateDesign(DEFAULT_DESIGN);
assert(good.layout === DEFAULT_DESIGN.layout, 'default passes through'); ok('validateDesign passthrough');

// legacy template mapping
for (const t of ['modern', 'classic', 'creative']) {
  const d = legacyTemplateToDesign(t);
  assert(LAYOUTS.includes(d.layout) && hex.test(d.palette.primary), `legacy ${t} maps to a valid design`);
}
ok('legacyTemplateToDesign');

console.log(`\nverifyDesignSystem: ${passed} checks passed`);
