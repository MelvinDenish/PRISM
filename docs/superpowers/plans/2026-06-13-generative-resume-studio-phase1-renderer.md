# Generative Resume Studio — Phase 1 (Renderer + Design System + Puppeteer PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 hardcoded resume templates with an AI-design-spec engine — a `design` token field, a server-authoritative design system that validates/repairs specs, a flexible client renderer (2 archetypes for the spike), and a faithful selectable-text PDF via server Puppeteer — proven end-to-end before more archetypes are added.

**Architecture:** A resume splits into `content` (existing facts schema, untouched) + `design` (tokens: layout/palette/fonts/density/headingStyle/sectionOrder/hidden). The server `resumeDesign` module is the single source of truth: it owns the catalog, `buildPalette`, `validateDesign`, and the legacy `template`→`design` mapping. The client `ResumeRenderer` reads tokens → inline styles. The same tokens drive a server `resumeHtml()` that Puppeteer prints to PDF (selectable, faithful). DOCX stays the flat ATS path.

**Tech Stack:** Node/Express (CJS) + Mongoose server; React 19 + Vite (ESM) client; `puppeteer` (new) for PDF; existing `storage` + `Artifact` for file persistence. No test runner — verification uses the repo's headless `verify*.js` script pattern (run with `node`).

**Spec:** [docs/superpowers/specs/2026-06-13-generative-resume-studio-design.md](../specs/2026-06-13-generative-resume-studio-design.md)

---

## File Structure

**Server (CJS):**
- Create `server/agent/services/resumeDesign.js` — catalog, `buildPalette`, `validateDesign`, `legacyTemplateToDesign`, `designStyleTokens` (token→style map shared in spirit with client), `DEFAULT_DESIGN`.
- Create `server/agent/services/resumePdf.js` — `resumeHtml(design, content)`, `renderResumePdf(draft)` (shared browser), `persistPdfArtifact(...)`.
- Modify `server/models/ResumeDraft.js` — add `design` subdocument.
- Modify `server/routes/resumeBuilder.js` — add `GET /design-system`; route PDF export through Puppeteer.
- Create `server/seeds/verifyDesignSystem.js`, `server/seeds/verifyResumePdf.js` — verification.

**Client (ESM):**
- Create `client/src/components/resume/designTokens.js` — client mirror of token→style map + section list (kept textually parallel to server; visual gate guards drift).
- Create `client/src/components/resume/ResumeRenderer.jsx` — token-driven renderer, 2 layout archetypes.
- Modify `client/src/components/resume/ResumePreview.jsx` — becomes a thin wrapper: map legacy `template`→`design`, delegate to `ResumeRenderer`.
- Modify `client/src/services/api.js` — add `getResumeDesignSystem()`.

---

## Task 1: Add `design` subdocument to ResumeDraft model

**Files:**
- Modify: `server/models/ResumeDraft.js:12-42`

- [ ] **Step 1: Add the `design` schema fields**

In `server/models/ResumeDraft.js`, after the `template` line (line 15) and before `personalInfo`, insert:

```js
    // ── Generative Resume Studio ──
    // AI-generated visual design spec. `template` is kept for backward-compat;
    // legacy drafts (no `design`) are mapped at read-time by legacyTemplateToDesign().
    design: {
        layout: { type: String, default: 'single-column' },
        palette: {
            primary: String, accent: String, text: String,
            muted: String, bg: String, surface: String,
        },
        fonts: { heading: String, body: String },
        density: { type: String, enum: ['compact', 'normal', 'roomy'], default: 'normal' },
        headingStyle: { type: String, enum: ['underline', 'bar', 'caps', 'plain'], default: 'underline' },
        sectionOrder: { type: [String], default: undefined },
        hidden: { type: [String], default: [] },
    },
```

- [ ] **Step 2: Verify the model still loads**

Run: `node -e "require('./server/models/ResumeDraft'); console.log('model ok')"`
Expected: prints `model ok` with no schema error.

- [ ] **Step 3: Commit**

```bash
git add server/models/ResumeDraft.js
git commit -m "feat(resume): add design token subdocument to ResumeDraft"
```

---

## Task 2: Design-system module (catalog, palette, validate, legacy map)

**Files:**
- Create: `server/agent/services/resumeDesign.js`
- Test: `server/seeds/verifyDesignSystem.js`

- [ ] **Step 1: Write the failing verification script**

Create `server/seeds/verifyDesignSystem.js`:

```js
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
const lum = (h) => { const n = parseInt(h.slice(1), 16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return (0.299*r+0.587*g+0.114*b)/255; };
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
```

- [ ] **Step 2: Run it to confirm it fails (module missing)**

Run: `node server/seeds/verifyDesignSystem.js`
Expected: FAIL — `Cannot find module '../agent/services/resumeDesign'`.

- [ ] **Step 3: Implement the design-system module**

Create `server/agent/services/resumeDesign.js`:

```js
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
```

- [ ] **Step 4: Run the verification to confirm it passes**

Run: `node server/seeds/verifyDesignSystem.js`
Expected: prints several `ok -` lines then `verifyDesignSystem: 7 checks passed`.

- [ ] **Step 5: Commit**

```bash
git add server/agent/services/resumeDesign.js server/seeds/verifyDesignSystem.js
git commit -m "feat(resume): server-authoritative design system (catalog, palette, validate, legacy map)"
```

---

## Task 3: Expose the design-system catalog via API + client wrapper

**Files:**
- Modify: `server/routes/resumeBuilder.js:12-13` (after `const router = ...`)
- Modify: `client/src/services/api.js`

- [ ] **Step 1: Add the read endpoint**

In `server/routes/resumeBuilder.js`, add this require near the top (after the existing `resume` service require, ~line 10):

```js
const { LAYOUTS, FONT_PAIRS, DENSITIES, HEADING_STYLES, SECTION_KEYS, SEED_KEYS } = require('../agent/services/resumeDesign');
```

Then add this route immediately after `const router = express.Router();`:

```js
// Public design-system catalog for the client's design panel (display lists only;
// buildPalette/validateDesign logic stays server-side and is never shipped).
router.get('/design-system', protect, (req, res) => {
  res.json({
    success: true,
    designSystem: {
      layouts: LAYOUTS,
      fontPairs: FONT_PAIRS,
      densities: DENSITIES,
      headingStyles: HEADING_STYLES,
      sectionKeys: SECTION_KEYS,
      paletteVibes: SEED_KEYS,
    },
  });
});
```

- [ ] **Step 2: Add the client API wrapper**

In `client/src/services/api.js`, add (next to the other resume exports):

```js
export const getResumeDesignSystem = () => api.get('/resume-builder/design-system');
```

- [ ] **Step 3: Verify the route is registered (smoke)**

Run: `node -e "const r=require('./server/routes/resumeBuilder'); console.log(typeof r === 'function' ? 'router ok' : 'bad')"`
Expected: prints `router ok` (module loads with the new require + route).

- [ ] **Step 4: Commit**

```bash
git add server/routes/resumeBuilder.js client/src/services/api.js
git commit -m "feat(resume): expose design-system catalog endpoint + client wrapper"
```

---

## Task 4: Client token-driven renderer (2 archetypes)

**Files:**
- Create: `client/src/components/resume/designTokens.js`
- Create: `client/src/components/resume/ResumeRenderer.jsx`

- [ ] **Step 1: Create the client token helpers**

Create `client/src/components/resume/designTokens.js` (kept textually parallel to the server `densityScale`; the §12 visual round-trip guards drift):

```js
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
```

- [ ] **Step 2: Create `ResumeRenderer.jsx`**

Create `client/src/components/resume/ResumeRenderer.jsx`. It preserves the existing `Editable` click-to-edit contract (path-based, e.g. `experience.2.description`) across both layouts and keeps `id="resume-preview"` on the root.

```jsx
/**
 * ResumeRenderer — token-driven, print-accurate resume render. The SAME DOM is
 * exported to PDF (Puppeteer prints an equivalent HTML; html2pdf reads
 * #resume-preview as a fallback). Two layout archetypes for the Phase-1 spike;
 * more are added once PDF fidelity is proven. Click-to-edit uses ORIGINAL array
 * indices so paths target the right entry regardless of layout.
 */
import { useState } from 'react';
import { densityScale, headingStyleCss, DEFAULT_DESIGN, SECTION_KEYS } from './designTokens';

const contactLine = (p) => [p.email, p.phone, p.location].filter(Boolean).join('  •  ');
const links = (p) => [p.linkedin, p.github, p.portfolio].filter(Boolean).join('  •  ');

const Editable = ({ value, path, onEdit, editable, style, multiline, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  if (!editable || !onEdit) return <>{value}</>;
  if (!editing) {
    return (
      <span className="rb-edit-target" title="Click to edit" style={style}
        onClick={() => { setDraft(value == null ? '' : String(value)); setEditing(true); }}>
        {value || <span style={{ opacity: 0.4 }}>{placeholder || 'Click to add'}</span>}
      </span>
    );
  }
  const commit = () => { setEditing(false); if (draft !== (value == null ? '' : String(value))) onEdit(path, draft); };
  const common = {
    autoFocus: true, className: 'rb-edit-input', value: draft, style,
    onChange: (e) => setDraft(e.target.value), onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
    },
  };
  return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
};

const Section = ({ title, hStyle, children, highlight }) => (
  <div className={highlight ? 'rb-section-highlight' : undefined} style={{ marginBottom: 'var(--rb-gap)', borderRadius: 4 }}>
    <h3 style={hStyle}>{title}</h3>
    {children}
  </div>
);

// Render one section's body by key. `ed` is the click-to-edit factory.
function SectionBody({ keyName, form, ed, editable, accent }) {
  const p = form.personalInfo || {};
  if (keyName === 'summary') {
    if (!(p.summary || editable)) return null;
    return <p style={{ fontSize: 'var(--rb-font)' }}>{ed('personalInfo.summary', p.summary, { multiline: true, placeholder: 'Add a 2–3 sentence summary' })}</p>;
  }
  if (keyName === 'skills') {
    if (!((form.skills || []).length || editable)) return null;
    return <p style={{ fontSize: 'var(--rb-font)' }}>{editable ? ed('skills', (form.skills || []).join(', '), { multiline: true, placeholder: 'Comma-separated skills' }) : (form.skills || []).join('  •  ')}</p>;
  }
  if (keyName === 'experience') {
    if (!(form.experience || []).some((e) => e && e.company)) return null;
    return (form.experience || []).map((e, i) => (e && e.company ? (
      <div key={i} style={{ marginBottom: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 13.5 }}>{ed(`experience.${i}.position`, e.position)}{e.company ? ' — ' : ''}{ed(`experience.${i}.company`, e.company)}</strong>
          <span style={{ color: 'var(--rb-muted)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.startDate} – {e.current ? 'Present' : e.endDate}</span>
        </div>
        {(e.description || editable) && <p style={{ fontSize: 12.5, marginTop: 3, color: 'var(--rb-muted)' }}>{ed(`experience.${i}.description`, e.description, { multiline: true, placeholder: 'Describe impact + metrics' })}</p>}
      </div>
    ) : null));
  }
  if (keyName === 'education') {
    if (!(form.education || []).some((e) => e && e.institution)) return null;
    return (form.education || []).map((e, i) => (e && e.institution ? (
      <div key={i} style={{ marginBottom: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 13 }}>{ed(`education.${i}.degree`, e.degree)}{e.field ? ', ' : ''}{ed(`education.${i}.field`, e.field)}</strong>
          <span style={{ color: 'var(--rb-muted)', fontSize: 11.5 }}>{e.startDate} – {e.endDate}</span>
        </div>
        <p style={{ color: 'var(--rb-muted)', fontSize: 12 }}>{ed(`education.${i}.institution`, e.institution)}{e.gpa ? ` • GPA ${e.gpa}` : ''}</p>
      </div>
    ) : null));
  }
  if (keyName === 'projects') {
    if (!(form.projects || []).some((pr) => pr && pr.name)) return null;
    return (form.projects || []).map((pr, i) => (pr && pr.name ? (
      <div key={i} style={{ marginBottom: 7 }}>
        <strong style={{ fontSize: 13 }}>{ed(`projects.${i}.name`, pr.name)}</strong>
        {(pr.description || editable) && <p style={{ fontSize: 12.5, color: 'var(--rb-muted)' }}>{ed(`projects.${i}.description`, pr.description, { multiline: true, placeholder: 'What it does' })}</p>}
        {pr.technologies && <p style={{ fontSize: 11.5, color: accent }}>Tech: {ed(`projects.${i}.technologies`, pr.technologies)}</p>}
      </div>
    ) : null));
  }
  return null;
}

const ResumeRenderer = ({ design, form, highlighted, editable = false, onEdit }) => {
  const d = design && design.layout ? design : DEFAULT_DESIGN;
  const pal = d.palette || DEFAULT_DESIGN.palette;
  const ds = densityScale(d.density);
  const hStyle = headingStyleCss(d.headingStyle, pal.primary);
  const p = form.personalInfo || {};
  const hiSet = highlighted instanceof Set ? highlighted : (Array.isArray(highlighted) ? new Set(highlighted) : null);
  const hi = (k) => hiSet && hiSet.has(k);

  const ed = (path, value, opts = {}) => <Editable value={value} path={path} onEdit={onEdit} editable={editable} {...opts} />;
  const order = (d.sectionOrder && d.sectionOrder.length ? d.sectionOrder : SECTION_KEYS).filter((k) => !(d.hidden || []).includes(k));

  const sheetVars = {
    '--rb-primary': pal.primary, '--rb-accent': pal.accent, '--rb-text': pal.text,
    '--rb-muted': pal.muted, '--rb-bg': pal.bg, '--rb-surface': pal.surface,
    '--rb-gap': `${ds.gap}px`, '--rb-font': `${ds.font}px`,
  };
  const sheet = {
    ...sheetVars, background: pal.bg, color: pal.text, width: '100%', maxWidth: 820,
    minHeight: 1040, margin: '0 auto', boxSizing: 'border-box',
    fontFamily: d.fonts?.body || DEFAULT_DESIGN.fonts.body, lineHeight: 1.55, fontSize: ds.font,
  };
  const headerHi = hi('personalInfo') ? 'rb-section-highlight' : '';
  const nameNode = editable
    ? <Editable value={p.fullName} path="personalInfo.fullName" onEdit={onEdit} editable placeholder="Your Name" />
    : (p.fullName || 'Your Name');

  const Sections = () => order.map((k) => {
    const body = <SectionBody keyName={k} form={form} ed={ed} editable={editable} accent={pal.accent} />;
    if (!body || (Array.isArray(body) && body.every((x) => x === null))) return null;
    const title = k.charAt(0).toUpperCase() + k.slice(1);
    return <Section key={k} title={title} hStyle={hStyle} highlight={hi(k === 'summary' ? 'personalInfo' : k)}>{body}</Section>;
  });

  const Header = ({ inverted }) => (
    <div className={headerHi} style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 28, margin: 0, color: inverted ? pal.bg : pal.text, fontFamily: d.fonts?.heading || DEFAULT_DESIGN.fonts.heading }}>{nameNode}</h1>
      <p style={{ color: inverted ? pal.bg : pal.muted, opacity: inverted ? 0.95 : 1, fontSize: 12.5, marginTop: 5 }}>{contactLine(p)}</p>
      {links(p) && <p style={{ color: inverted ? pal.bg : pal.accent, opacity: inverted ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
    </div>
  );

  if (d.layout === 'sidebar-left') {
    return (
      <div id="resume-preview" style={{ ...sheet, padding: 0, display: 'flex' }}>
        <div style={{ width: 220, background: pal.surface, padding: ds.pad, boxSizing: 'border-box' }}>
          <Header />
        </div>
        <div style={{ flex: 1, padding: ds.pad, boxSizing: 'border-box' }}>
          <Sections />
        </div>
      </div>
    );
  }

  // single-column (default)
  return (
    <div id="resume-preview" style={{ ...sheet, padding: ds.pad }}>
      <div style={{ borderLeft: `5px solid ${pal.primary}`, paddingLeft: 16 }}><Header /></div>
      <Sections />
    </div>
  );
};

export default ResumeRenderer;
```

- [ ] **Step 3: Verify the client build compiles**

Run: `cd client && npm run build`
Expected: build succeeds (no syntax/import errors). It's acceptable if unrelated pre-existing warnings appear; there must be no error referencing `ResumeRenderer` or `designTokens`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/resume/designTokens.js client/src/components/resume/ResumeRenderer.jsx
git commit -m "feat(resume): token-driven ResumeRenderer (single-column + sidebar-left)"
```

---

## Task 5: Make `ResumePreview` delegate to the renderer (no call-site changes)

**Files:**
- Modify: `client/src/components/resume/ResumePreview.jsx` (full rewrite to a thin wrapper)

- [ ] **Step 1: Replace ResumePreview with a delegating wrapper**

Overwrite `client/src/components/resume/ResumePreview.jsx` with:

```jsx
/**
 * ResumePreview — backward-compatible wrapper. Existing call sites pass `form`
 * (which may carry `form.design` or only a legacy `form.template`). We resolve a
 * design spec and delegate to ResumeRenderer so the 3 legacy templates keep
 * working while new drafts render from AI design tokens.
 */
import ResumeRenderer from './ResumeRenderer';
import { DEFAULT_DESIGN } from './designTokens';

// Mirror of server legacyTemplateToDesign for the 3 legacy templates (display only).
const LEGACY = {
  modern:  { ...DEFAULT_DESIGN, layout: 'single-column', headingStyle: 'underline' },
  classic: { ...DEFAULT_DESIGN, layout: 'single-column', headingStyle: 'caps',
             palette: { primary: '#1f2937', accent: '#2563eb', text: '#111827', muted: '#6b7280', bg: '#ffffff', surface: '#f4f5f7' } },
  creative:{ ...DEFAULT_DESIGN, layout: 'sidebar-left', headingStyle: 'bar',
             palette: { primary: '#b91c1c', accent: '#ea580c', text: '#2a1414', muted: '#6f5a57', bg: '#ffffff', surface: '#fbf3f1' } },
};

const ResumePreview = ({ form, highlighted, editable = false, onEdit }) => {
  const design = (form && form.design && form.design.layout)
    ? form.design
    : (LEGACY[form?.template] || LEGACY.modern);
  return <ResumeRenderer design={design} form={form} highlighted={highlighted} editable={editable} onEdit={onEdit} />;
};

export default ResumePreview;
```

- [ ] **Step 2: Verify the client build still compiles**

Run: `cd client && npm run build`
Expected: build succeeds; no error referencing `ResumePreview`.

- [ ] **Step 3: Manual smoke (visual gate, part 1)**

Run the app (`cd server && npm run dev`, then `cd client && npm run dev`), open the Resume Builder, open an existing draft, and confirm the live preview renders (legacy templates now route through the renderer). Use the available `chrome-devtools`/`playwright` MCP to screenshot the preview; confirm no layout breakage vs. before.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/resume/ResumePreview.jsx
git commit -m "refactor(resume): ResumePreview delegates to ResumeRenderer (legacy templates preserved)"
```

---

## Task 6: Server Puppeteer PDF (resumeHtml + renderResumePdf)

**Files:**
- Modify: `server/package.json` (add `puppeteer`)
- Create: `server/agent/services/resumePdf.js`
- Test: `server/seeds/verifyResumePdf.js`

- [ ] **Step 1: Add Puppeteer**

Run: `cd server && npm install puppeteer`
Expected: installs `puppeteer` (downloads a pinned Chromium). Confirm it appears in `server/package.json` dependencies.

- [ ] **Step 2: Write the failing verification script**

Create `server/seeds/verifyResumePdf.js`:

```js
/* Headless verification for the resume PDF renderer. Run: node server/seeds/verifyResumePdf.js
   Requires Chromium (installed by puppeteer). No DB needed. */
const assert = require('assert');
const { resumeHtml, renderResumePdf, closeBrowser } = require('../agent/services/resumePdf');
const { DEFAULT_DESIGN } = require('../agent/services/resumeDesign');

const sampleDraft = {
  design: DEFAULT_DESIGN,
  personalInfo: { fullName: 'Asha Rao', email: 'asha@example.com', phone: '555-0100', location: 'Bengaluru', summary: 'Backend engineer with 4 years building payment systems.' },
  skills: ['Java', 'Spring', 'PostgreSQL', 'Kafka'],
  experience: [{ company: 'PayCo', position: 'SWE II', startDate: '2022', endDate: '', current: true, description: 'Cut checkout latency 38% by redesigning the settlement pipeline.' }],
  education: [{ institution: 'IISc', degree: 'B.Tech', field: 'CSE', startDate: '2016', endDate: '2020', gpa: '8.6' }],
  projects: [{ name: 'OpenLedger', description: 'A double-entry ledger lib.', technologies: 'Go, SQLite' }],
};

(async () => {
  // HTML emitter: includes name + a section heading + escapes nothing dangerous.
  const html = resumeHtml(DEFAULT_DESIGN, sampleDraft);
  assert(/Asha Rao/.test(html), 'html contains the name');
  assert(/Experience/i.test(html), 'html contains a section heading');
  assert(/<style/.test(html) && /--rb-primary/.test(html), 'html carries design CSS vars');
  console.log('  ok - resumeHtml');

  // PDF: real selectable PDF buffer.
  const buf = await renderResumePdf(sampleDraft);
  assert(Buffer.isBuffer(buf) && buf.length > 1000, 'pdf buffer is non-trivial');
  assert(buf.slice(0, 5).toString() === '%PDF-', 'buffer is a PDF');
  console.log('  ok - renderResumePdf (' + buf.length + ' bytes)');

  await closeBrowser();
  console.log('\nverifyResumePdf: 2 checks passed');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
```

- [ ] **Step 3: Run it to confirm it fails (module missing)**

Run: `node server/seeds/verifyResumePdf.js`
Expected: FAIL — `Cannot find module '../agent/services/resumePdf'`.

- [ ] **Step 4: Implement the PDF service**

Create `server/agent/services/resumePdf.js`:

```js
/**
 * Resume PDF via headless Chrome (Puppeteer). Produces a faithful, selectable
 * PDF from the design tokens. This intentionally supersedes the "no headless
 * Chrome" note in document.js FOR THE RESUME PDF ONLY — the generic
 * generateDocument (pdfkit) path is unchanged for DOCX/md/other docs.
 *
 * One shared browser instance is reused across requests to bound memory/cold-start.
 */
const { resolveDesign, densityScale } = require('./resumeDesign');

let _browserPromise = null;
async function getBrowser() {
  if (!_browserPromise) {
    const puppeteer = require('puppeteer');
    _browserPromise = puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  }
  return _browserPromise;
}
async function closeBrowser() {
  if (_browserPromise) {
    const b = await _browserPromise; _browserPromise = null;
    try { await b.close(); } catch { /* best-effort */ }
  }
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const join = (arr, sep) => arr.filter(Boolean).join(sep);

function headingCss(headingStyle) {
  switch (headingStyle) {
    case 'caps':  return 'text-transform:uppercase;letter-spacing:1.5px;';
    case 'bar':   return 'border-left:4px solid var(--rb-primary);padding-left:8px;';
    case 'plain': return '';
    case 'underline':
    default:      return 'text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--rb-primary);padding-bottom:4px;';
  }
}

function sectionHtml(key, draft) {
  const p = draft.personalInfo || {};
  if (key === 'summary') return p.summary ? `<p>${esc(p.summary)}</p>` : '';
  if (key === 'skills') return (draft.skills || []).length ? `<p>${esc((draft.skills || []).join('  •  '))}</p>` : '';
  if (key === 'experience') {
    const rows = (draft.experience || []).filter((e) => e && e.company).map((e) => `
      <div class="entry"><div class="row"><strong>${esc(join([e.position, e.company], ' — '))}</strong>
      <span class="muted">${esc(e.startDate)} – ${e.current ? 'Present' : esc(e.endDate)}</span></div>
      ${e.description ? `<p class="muted">${esc(e.description)}</p>` : ''}</div>`).join('');
    return rows;
  }
  if (key === 'education') {
    return (draft.education || []).filter((e) => e && e.institution).map((e) => `
      <div class="entry"><div class="row"><strong>${esc(join([e.degree, e.field], ', '))}</strong>
      <span class="muted">${esc(e.startDate)} – ${esc(e.endDate)}</span></div>
      <p class="muted">${esc(e.institution)}${e.gpa ? ` • GPA ${esc(e.gpa)}` : ''}</p></div>`).join('');
  }
  if (key === 'projects') {
    return (draft.projects || []).filter((pr) => pr && pr.name).map((pr) => `
      <div class="entry"><strong>${esc(pr.name)}</strong>
      ${pr.description ? `<p class="muted">${esc(pr.description)}</p>` : ''}
      ${pr.technologies ? `<p class="accent">Tech: ${esc(pr.technologies)}</p>` : ''}</div>`).join('');
  }
  return '';
}

/** Build a complete standalone HTML document from design tokens + content. */
function resumeHtml(designIn, draft) {
  const d = designIn && designIn.layout ? designIn : resolveDesign(draft);
  const pal = d.palette; const ds = densityScale(d.density);
  const p = draft.personalInfo || {};
  const order = (d.sectionOrder && d.sectionOrder.length ? d.sectionOrder : ['summary', 'experience', 'skills', 'projects', 'education'])
    .filter((k) => !(d.hidden || []).includes(k));
  const contact = join([p.email, p.phone, p.location], '  •  ');
  const linkLine = join([p.linkedin, p.github, p.portfolio], '  •  ');

  const sections = order.map((k) => {
    const body = sectionHtml(k, draft);
    if (!body) return '';
    const title = k.charAt(0).toUpperCase() + k.slice(1);
    return `<section><h3>${esc(title)}</h3>${body}</section>`;
  }).join('');

  const header = `<header><h1>${esc(p.fullName || 'Your Name')}</h1>
    ${contact ? `<p class="muted">${esc(contact)}</p>` : ''}
    ${linkLine ? `<p class="accent">${esc(linkLine)}</p>` : ''}</header>`;

  const isSidebar = d.layout === 'sidebar-left';
  const bodyInner = isSidebar
    ? `<div class="sidebar">${header}</div><main>${sections}</main>`
    : `<div class="rule">${header}</div>${sections}`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{--rb-primary:${pal.primary};--rb-accent:${pal.accent};--rb-text:${pal.text};
      --rb-muted:${pal.muted};--rb-bg:${pal.bg};--rb-surface:${pal.surface};}
    @page{size:A4;margin:0;}
    *{box-sizing:border-box;}
    body{margin:0;background:var(--rb-bg);color:var(--rb-text);
      font-family:${d.fonts?.body || 'Georgia, serif'};font-size:${ds.font}px;line-height:1.55;}
    .page{max-width:820px;min-height:1040px;margin:0 auto;${isSidebar ? 'display:flex;padding:0;' : `padding:${ds.pad}px;`}}
    h1{font-size:28px;margin:0;color:var(--rb-text);font-family:${d.fonts?.heading || 'Helvetica, sans-serif'};}
    h3{color:var(--rb-primary);font-size:13px;font-weight:700;margin:0 0 8px;${headingCss(d.headingStyle)}}
    section{margin-bottom:${ds.gap}px;}
    header{margin-bottom:22px;}
    .rule{border-left:5px solid var(--rb-primary);padding-left:16px;}
    .sidebar{width:220px;background:var(--rb-surface);padding:${ds.pad}px;}
    main{flex:1;padding:${ds.pad}px;}
    .muted{color:var(--rb-muted);} .accent{color:var(--rb-accent);}
    .row{display:flex;justify-content:space-between;align-items:baseline;}
    .entry{margin-bottom:11px;} p{margin:3px 0;}
  </style></head><body><div class="page">${bodyInner}</div></body></html>`;
}

/** Render a draft to a PDF buffer (resolves its design if not passed one). */
async function renderResumePdf(draft) {
  const design = resolveDesign(draft);
  const html = resumeHtml(design, draft);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

module.exports = { resumeHtml, renderResumePdf, getBrowser, closeBrowser };
```

- [ ] **Step 5: Run the verification to confirm it passes**

Run: `node server/seeds/verifyResumePdf.js`
Expected: prints `ok - resumeHtml`, `ok - renderResumePdf (NNNN bytes)`, then `verifyResumePdf: 2 checks passed`.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/agent/services/resumePdf.js server/seeds/verifyResumePdf.js
git commit -m "feat(resume): Puppeteer-rendered selectable PDF from design tokens"
```

---

## Task 7: Route PDF export through Puppeteer (DOCX unchanged)

**Files:**
- Modify: `server/routes/resumeBuilder.js:317-346` (the `/drafts/:id/export` handler)

- [ ] **Step 1: Add the PDF persistence helper to resumePdf.js**

Append to `server/agent/services/resumePdf.js` (before `module.exports`), reusing the same storage + Artifact pattern as `document.js`:

```js
const Artifact = require('../../models/Artifact');
const storage = require('../../utils/storage');

/** Render a draft to PDF, save it, persist an Artifact, return { id,title,format,url }. */
async function exportResumePdfArtifact({ userId, draft, title }) {
  const buffer = await renderResumePdf(draft);
  const { key } = await storage.saveFile({
    buffer, mimeType: 'application/pdf', originalName: `${title}.pdf`, folder: 'artifacts',
  });
  let artifact;
  try {
    artifact = await Artifact.create({
      user: userId, kind: 'resume', title, format: 'pdf',
      artifactKey: key, artifactDriver: storage.driver, sizeBytes: buffer.byteLength,
    });
  } catch (e) {
    try { await storage.deleteFile(key); } catch { /* best-effort */ }
    throw e;
  }
  const id = String(artifact._id);
  return { id, title, format: 'pdf', url: `/api/artifacts/${id}/download` };
}
```

And add `exportResumePdfArtifact` to the `module.exports` object in that file.

- [ ] **Step 2: Use it in the export route**

In `server/routes/resumeBuilder.js`, add near the other service requires (top of file):

```js
const { exportResumePdfArtifact } = require('../agent/services/resumePdf');
```

Then in the `/drafts/:id/export` handler, replace the block that builds `content` and calls `generateDocument` with a format branch:

```js
    const titleBase = (draft.personalInfo && draft.personalInfo.fullName) || draft.name || 'Resume';
    const title = `${titleBase} — Resume`.slice(0, 120);

    let artifact;
    if (format === 'pdf') {
      // PDF = designed + selectable, via Puppeteer.
      artifact = await exportResumePdfArtifact({ userId: req.user._id, draft, title });
    } else {
      // DOCX = ATS-plain flat extraction (unchanged).
      const content = _buildResumeSections(draft);
      artifact = await generateDocument({ userId: req.user._id, kind: 'resume', title, format, content });
    }
    return res.json({ success: true, artifact });
```

- [ ] **Step 3: Verify the route module still loads**

Run: `node -e "require('./server/routes/resumeBuilder'); console.log('route ok')"`
Expected: prints `route ok`.

- [ ] **Step 4: Manual smoke (visual gate, part 2)**

With the app running, open a draft → Export PDF. Confirm the downloaded `.pdf` opens, text is **selectable** (not an image), and the design (colors, sidebar if used) matches the preview. Repeat for `sidebar-left`. Screenshot both via MCP and eyeball for clipping/overflow. Export DOCX too — confirm it's still the plain ATS layout.

- [ ] **Step 5: Commit**

```bash
git add server/routes/resumeBuilder.js server/agent/services/resumePdf.js
git commit -m "feat(resume): export PDF via Puppeteer (designed+selectable); DOCX stays ATS-plain"
```

---

## Self-Review

- **Spec coverage (Phase 1 scope):** §4 content/design split → Task 1; §6.2 design system (catalog/buildPalette/validateDesign/legacy map) → Task 2; client/server sharing endpoint → Task 3; §6.3 ResumeRenderer + click-to-edit preserved + `#resume-preview` → Tasks 4–5; §9 Puppeteer PDF (resumeHtml parity, shared browser, selectable) + DOCX unchanged → Tasks 6–7; §12 visual gate → manual steps in Tasks 5 & 7; §13 "1–2 archetypes first, PDF spike first" → this whole plan. **Out of Phase 1 (later plans):** intake copilot, NL/visual editing panel, cover letter, font bundling, more archetypes.
- **Placeholder scan:** none — every code step contains full code; verify steps give exact commands + expected output.
- **Type consistency:** `validateDesign`/`resolveDesign`/`densityScale`/`buildPalette`/`legacyTemplateToDesign` names match across server tasks; `resumeHtml`/`renderResumePdf`/`closeBrowser`/`exportResumePdfArtifact` consistent across Tasks 6–7; client `densityScale`/`headingStyleCss`/`DEFAULT_DESIGN`/`SECTION_KEYS` consistent across Tasks 4–5; `#resume-preview` id preserved; click-to-edit `path` format (`experience.2.description`) matches the existing `applySectionEdit` whitelist.

## Risks / notes for the executor

- **Chromium download:** `npm install puppeteer` pulls a Chromium (~150MB) and needs a working sandbox. On Linux CI/containers you may need `--no-sandbox` (already set) and OS libs; if the install must skip the download, switch to `puppeteer-core` + a system Chromium path. Document the dependency in the server README/.env notes.
- **Parity drift:** the React renderer (Task 4) and `resumeHtml` (Task 6) are two emitters of the same tokens. The manual visual gate (Tasks 5, 7) is the guard. Keep their structure/CSS aligned when editing either.
- **Fonts:** spike uses web-safe stacks so preview and Chromium match with zero `@font-face`. Curated `@fontsource` pairs come in the archetype-expansion plan and must be loaded in BOTH the client and the Puppeteer HTML.
