/**
 * Curated, research-backed resume design systems.
 *
 * Each entry is an INTERNALLY COHERENT combination (palette + Google-Font pairing +
 * layout archetype + accent rules), distilled from professional typography-pairing
 * and editorial/resume layout practice. The design model composes from a proven
 * quality floor instead of picking accent/font/layout orthogonally at random (the
 * old `styleSeed`, which could pair clashing choices and looked generic).
 *
 * HARD CONSTRAINTS:
 *  - `headingFont`/`bodyFont` MUST be Google / open-source family names — resumeFonts
 *    embeds whatever the model names, and these are the names we steer it toward.
 *  - `accentHex` is a single deliberate accent; `neutrals` give an accessible ink/
 *    muted/line/bg ramp so contrast stays strong.
 *  - `layout` is one of the archetypes the structural+vision critic understands.
 *
 * Divergence across best-of-N proposers (and Regenerate) comes from selecting
 * DIFFERENT systems here — not from random orthogonal seeds.
 */

const LAYOUTS = [
  'two-column-sidebar',     // full-height colored left sidebar (contact/skills) + wide main
  'single-column-editorial', // one column, strong hierarchy, hairline dividers
  'header-band',            // bold full-bleed header band, single body column
  'asymmetric-grid',        // strong left name block, clearly sectioned content
  'slim-right-rail',        // narrow right rail for skills/links, main on the left
  'centered-thin-rule',     // centered name with a thin accent rule, balanced body
];

// Shared professional neutral ramp; a few systems tweak ink/bg for character.
const N = { ink: '#111827', muted: '#4b5563', line: '#e5e7eb', bg: '#ffffff' };
const N_WARM = { ink: '#1c1917', muted: '#57534e', line: '#e7e5e4', bg: '#fffdf9' };
const N_COOL = { ink: '#0f172a', muted: '#475569', line: '#e2e8f0', bg: '#ffffff' };

const DESIGN_SYSTEMS = [
  {
    name: 'Editorial Serif', vibe: 'refined, publication-grade',
    accentHex: '#1e3a8a', neutrals: N_COOL,
    headingFont: 'Fraunces', bodyFont: 'Inter', layout: 'single-column-editorial',
    accentUsage: 'accent only on the name, section rules, and link underlines',
    note: 'high-contrast serif display name over a clean sans body; hairline dividers; generous leading',
  },
  {
    name: 'Modern Geometric', vibe: 'confident, contemporary tech',
    accentHex: '#0f766e', neutrals: N,
    headingFont: 'Space Grotesk', bodyFont: 'Work Sans', layout: 'two-column-sidebar',
    accentUsage: 'accent fills the left sidebar; white text on accent for contact/skills',
    note: 'geometric sans headings, a deep-teal sidebar holding contact + skill chips, wide main column',
  },
  {
    name: 'Refined Garamond', vibe: 'elegant, classic',
    accentHex: '#9f1239', neutrals: N_WARM,
    headingFont: 'Cormorant Garamond', bodyFont: 'IBM Plex Sans', layout: 'centered-thin-rule',
    accentUsage: 'accent on the centered name and a single thin rule beneath it',
    note: 'large elegant serif name, centered, with a delicate burgundy rule; airy and understated',
  },
  {
    name: 'Technical Mono', vibe: 'engineering, precise',
    accentHex: '#334155', neutrals: N_COOL,
    headingFont: 'Space Grotesk', bodyFont: 'IBM Plex Sans', layout: 'slim-right-rail',
    accentUsage: 'accent on section labels rendered in a monospace micro-caps style',
    note: 'crisp grotesque headings, body in Plex Sans, monospace section labels; a slim right rail for skills/links',
  },
  {
    name: 'Warm Humanist', vibe: 'approachable, editorial',
    accentHex: '#166534', neutrals: N_WARM,
    headingFont: 'Newsreader', bodyFont: 'Source Sans 3', layout: 'single-column-editorial',
    accentUsage: 'accent on section titles and the date column',
    note: 'humanist serif headlines over a readable sans body; warm off-white page; comfortable rhythm',
  },
  {
    name: 'Clean Manrope', vibe: 'minimal, modern',
    accentHex: '#475569', neutrals: N,
    headingFont: 'Manrope', bodyFont: 'Manrope', layout: 'slim-right-rail',
    accentUsage: 'no color accent except hairlines; hierarchy carried purely by Manrope weight steps',
    note: 'all-sans on Manrope, strong weight contrast for hierarchy, monochrome with a slim right rail',
  },
  {
    name: 'Bold Header Band', vibe: 'striking, decisive',
    accentHex: '#1d4ed8', neutrals: N_COOL,
    headingFont: 'Archivo', bodyFont: 'Public Sans', layout: 'header-band',
    accentUsage: 'full-bleed accent header band with the name + contact reversed out in white',
    note: 'a bold cobalt header band anchors a single clean body column with strong weight steps',
  },
  {
    name: 'Friendly Rounded', vibe: 'warm, personable',
    accentHex: '#6d28d9', neutrals: N_WARM,
    headingFont: 'Poppins', bodyFont: 'Lora', layout: 'two-column-sidebar',
    accentUsage: 'accent on the sidebar header and section markers',
    note: 'rounded sans headings with a readable serif body; a plum sidebar for contact/skills',
  },
  {
    name: 'Crisp Grotesque', vibe: 'structured, design-led',
    accentHex: '#374151', neutrals: N,
    headingFont: 'Sora', bodyFont: 'Work Sans', layout: 'asymmetric-grid',
    accentUsage: 'accent on a vertical rule beside the name block and on section numbers',
    note: 'strong left-aligned name block, asymmetric grid, numbered sections; charcoal accent, lots of air',
  },
  {
    name: 'Plex Professional', vibe: 'corporate, trustworthy',
    accentHex: '#4338ca', neutrals: N_COOL,
    headingFont: 'IBM Plex Sans', bodyFont: 'IBM Plex Sans', layout: 'two-column-sidebar',
    accentUsage: 'indigo sidebar fill; accent rules separating main-column sections',
    note: 'unified IBM Plex system, indigo sidebar with skills/contact, disciplined and corporate-clean',
  },
  {
    name: 'Elegant Playfair', vibe: 'sophisticated, premium',
    accentHex: '#047857', neutrals: N,
    headingFont: 'Playfair Display', bodyFont: 'Source Sans 3', layout: 'centered-thin-rule',
    accentUsage: 'accent on the name and thin section rules only',
    note: 'dramatic Playfair name, centered, over a quiet sans body; emerald hairlines; premium restraint',
  },
  {
    name: 'Jakarta Minimal', vibe: 'clean startup',
    accentHex: '#0e7490', neutrals: N_COOL,
    headingFont: 'Plus Jakarta Sans', bodyFont: 'Plus Jakarta Sans', layout: 'slim-right-rail',
    accentUsage: 'cyan accent on section titles and skill chip outlines',
    note: 'modern all-sans, skill chips, a slim right rail; bright but disciplined cyan accent',
  },
  {
    name: 'Source Editorial', vibe: 'journalistic, dense-but-readable',
    accentHex: '#7c2d12', neutrals: N_WARM,
    headingFont: 'Source Serif 4', bodyFont: 'Inter', layout: 'single-column-editorial',
    accentUsage: 'accent on section titles and the leading rule',
    note: 'editorial serif headings over Inter; tight, information-rich single column with clear rules',
  },
  {
    name: 'Outfit Modern', vibe: 'energetic, product-y',
    accentHex: '#b91c1c', neutrals: N,
    headingFont: 'Outfit', bodyFont: 'Work Sans', layout: 'header-band',
    accentUsage: 'crimson header band with reversed name; accent section markers below',
    note: 'a clean Outfit header band, confident and modern, over a structured body column',
  },
  {
    name: 'Garamond Monochrome', vibe: 'timeless, ink-only',
    accentHex: '#111827', neutrals: N,
    headingFont: 'EB Garamond', bodyFont: 'Inter', layout: 'single-column-editorial',
    accentUsage: 'no color — ink-only, hierarchy from a classic serif headline + hairline rules',
    note: 'classic Garamond headings, monochrome and editorial; the restraint reads as premium',
  },
  {
    name: 'Manrope Amber Sidebar', vibe: 'warm-professional',
    accentHex: '#b45309', neutrals: N_WARM,
    headingFont: 'Manrope', bodyFont: 'Source Sans 3', layout: 'two-column-sidebar',
    accentUsage: 'amber sidebar fill for contact/skills; accent rules in the main column',
    note: 'Manrope headings, an amber sidebar holding contact + skills, a warm and readable main column',
  },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickDesignSystem = () => pick(DESIGN_SYSTEMS);

/** The steer string injected into the design prompt (replaces the old random styleSeed). */
function designSystemSeedText(s) {
  return [
    `STYLE SEED (interpret with taste for variety; never mention it in the resume): build the "${s.name}" design system — ${s.vibe}.`,
    `Layout: ${s.layout}. Headings in '${s.headingFont}', body in '${s.bodyFont}' — name these fonts directly in your CSS (the system embeds them).`,
    `Accent ${s.accentHex}; neutrals ink ${s.neutrals.ink} / muted ${s.neutrals.muted} / hairline ${s.neutrals.line} / page ${s.neutrals.bg}. Accent usage: ${s.accentUsage}.`,
    `Art direction: ${s.note}. Make it look clearly design-led and distinct — never a generic centered-name + underlined-ALL-CAPS template.`,
  ].join('\n');
}

module.exports = { DESIGN_SYSTEMS, LAYOUTS, pickDesignSystem, designSystemSeedText };
