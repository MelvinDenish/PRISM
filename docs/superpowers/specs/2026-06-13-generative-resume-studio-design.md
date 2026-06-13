# Generative Resume Studio — Design

**Date:** 2026-06-13
**Status:** Draft for review
**Branch:** wip/pre-m1-working-changes
**Author:** brainstormed with the project owner

---

## 1. Problem

The current Resume Builder ships **3 hardcoded templates** (`modern`, `classic`,
`creative`) that live as fixed React branches in
[`ResumePreview.jsx`](../../../client/src/components/resume/ResumePreview.jsx)
with fixed accent colors (`ACCENTS`). The AI never touches design — it only
writes *content* (`summary`, `skills`, experience descriptions) into that fixed
structure via `shapeDraft`. The "copilot" canvas
([`ResumeBuilder.jsx`](../../../client/src/pages/ResumeBuilder.jsx)) pulls from
the saved profile or a JD box and **never asks the user anything**.

Result: every resume looks essentially the same, and the "copilot" doesn't
converse. The owner's verdict: *"the ai resume maker is shit."*

## 2. Goals

1. **Pure AI-generated design** — every generation produces a *unique* layout,
   color scheme, and typography. No user-facing template picker.
2. **A conversational copilot** — when asked to make a resume, it *asks for the
   details* one question at a time (chat), prefilling silently from the saved
   profile and only asking for gaps.
3. **Edit after generation, two ways** — (a) natural language ("make it teal",
   "two columns", "tighten the second job"), and (b) a **structured visual
   editor** (the "Canva feel"): click-to-edit text, drag-reorder/show-hide
   sections, and live controls for palette / fonts / layout / density.
4. **Résumé + cover letter** in v1, with reliable downloads.

## 3. Non-goals (YAGNI for v1)

- **Free-form drag-anywhere canvas.** Absolute-positioned text boxes break ATS
  parsing and reliable export, and are a months-long build. We do *structured*
  visual editing instead.
- **AI emitting raw HTML/CSS.** Fragile export, broken click-to-edit, XSS
  surface. The AI emits a **structured design spec**; our renderer interprets it.
- **Arbitrary document types** (portfolio one-pagers, bios, etc.). Deferred until
  the engine is proven. v1 = résumé + cover letter only.
- **Multi-page resumes / pagination control.** Out of scope for v1.

## 4. Core concept — separate `content` from `design`

The whole design pivots on splitting the resume into two independent things:

- **`content`** — the user's facts (the existing `personalInfo`, `education`,
  `experience`, `skills`, `projects` schema). Unchanged. Guarded by the existing
  "never invent employers/degrees/dates/metrics" rule.
- **`design`** — a structured spec of *tokens* the AI generates, e.g.:

```jsonc
{
  "layout": "sidebar-left",          // an archetype the renderer knows
  "palette": {
    "primary": "#0f766e", "accent": "#f59e0b",
    "text": "#1a1a1a", "muted": "#666666",
    "bg": "#ffffff", "surface": "#f5f7f7"
  },
  "fonts":   { "heading": "Sora", "body": "Inter" },  // from a curated pair list
  "density": "normal",               // compact | normal | roomy
  "headingStyle": "underline",       // underline | bar | caps | plain
  "sectionOrder": ["summary", "experience", "skills", "projects", "education"],
  "hidden": []                        // section keys hidden by the user
}
```

A flexible **`ResumeRenderer`** interprets the spec into CSS custom properties +
a layout component. Because the AI freely combines `layout × palette × fonts ×
density × headingStyle × sectionOrder`, the output space is combinatorially huge
("unique each time"), while the renderer guarantees every output is valid,
editable, and exportable. **The same DOM is what exports to PDF** (preserving the
existing WYSIWYG contract).

### Quality floor (so "pure AI" never means "ugly")

The AI is **constrained to sample from a curated design system** — a fixed set of
polished layout archetypes, a curated list of font pairings, and palette-
generation rules. This reuses the spirit of the existing
[`themeGenerator`](../../../server/utils/themeGenerator.js) (`themeFromPrompt`),
which already maps a vibe word → an accessible accent palette. Curation lives in
the **AI's guardrails**, not in a shelf the user picks from. Invalid specs are
rejected/repaired server-side before persistence.

## 5. Architecture overview (three pillars + export)

```
                ┌─────────────────────────────────────────────┐
   chat intake  │  Pillar 2: Conversational Intake Copilot     │
  "make me a    │  (embedded chat → asks gaps → generates       │
   resume"      │   content + design spec)                      │
                └───────────────┬─────────────────────────────┘
                                │ creates ResumeDraft { content, design }
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Pillar 1: Design-spec Renderer (the keystone)               │
   │  design system catalog ─▶ ResumeRenderer(design, content)    │
   │  replaces the 3 hardcoded templates                          │
   └───────────────┬───────────────────────────┬─────────────────┘
                   │ live preview               │ same DOM
                   ▼                            ▼
   ┌──────────────────────────────┐   ┌────────────────────────────┐
   │ Pillar 3: Structured Visual  │   │ Export                     │
   │ Editor                       │   │ PDF = designed DOM (fidelity)│
   │ - click-to-edit text         │   │ DOCX = ATS-plain extraction  │
   │ - drag-reorder / show-hide   │   └────────────────────────────┘
   │ - palette/font/layout/density│
   │ - NL design+content commands │
   └──────────────────────────────┘
```

**Reused infrastructure (not rebuilt):** the provider-agnostic LLM wrapper
(`agent/llm.js`), the bounded tool-calling loop pattern (`agent/runAgent.js`),
JSON-fence stripping + `shapeDraft` + the hallucination guard
(`agent/services/resume.js`), `themeFromPrompt` (`utils/themeGenerator.js`), the
document export pipeline (`agent/services/document.js`), and the existing
revisions / ATS / tailor machinery on `ResumeDraft`.

---

## 6. Pillar 1 — Design-spec renderer (keystone)

### 6.1 Data model (`server/models/ResumeDraft.js`)

Add a `design` subdocument; keep `template` for backward compatibility.

```js
design: {
  layout: { type: String, default: 'single-column' },
  palette: {
    primary: String, accent: String, text: String,
    muted: String, bg: String, surface: String,
  },
  fonts: { heading: String, body: String },
  density: { type: String, enum: ['compact', 'normal', 'roomy'], default: 'normal' },
  headingStyle: { type: String, enum: ['underline', 'bar', 'caps', 'plain'], default: 'underline' },
  sectionOrder: [String],
  hidden: [String],
}
```

- **Backward compatibility:** a legacy draft with only `template` and no `design`
  is mapped at read-time to an equivalent design preset (`modern`/`classic`/
  `creative` → a `{layout, palette, fonts, ...}`). No data migration required;
  the mapping is a pure function used wherever a draft is loaded.

### 6.2 The design system catalog (`server/agent/services/resumeDesign.js`, shared shape with client)

A single source of truth for what the renderer supports and what the AI may emit:

- `LAYOUT_ARCHETYPES`: e.g. `single-column`, `sidebar-left`, `sidebar-right`,
  `header-band`, `two-column`, `timeline` (start with ~5–6).
  - **Aesthetic bar (load-bearing — this is what "shit" was about).** "Each
    individually polished" is the whole ballgame: 6 mediocre layouts is the
    3-template problem with more buttons. Each archetype is built against the
    `frontend-design` / `ui-ux-pro-max` skill references for real typographic
    rhythm, spacing scale, and hierarchy — **not** generic AI-default styling. An
    archetype isn't "done" until it passes the visual gate in §12.
- `FONT_PAIRS`: ~10–12 curated `{ heading, body }` pairs, all bundled/loaded and
  print-safe (via `@fontsource` or self-hosted; see 6.4).
- `DENSITY` and `HEADING_STYLE` enums (mirrors the schema).
- `buildPalette(vibe | seed)`: palette generation that **guarantees WCAG-ish
  contrast** between `text`/`bg` and a coherent `primary`/`accent`. Reuses /
  extends `themeFromPrompt`.
- `validateDesign(design)`: clamps/repairs an AI-produced spec to the catalog
  (unknown layout → nearest known; bad hex → repaired; missing fields → defaults;
  `sectionOrder` filtered to known section keys). **Server is authoritative** —
  the client never trusts a raw AI spec.

**Client/server sharing.** This is a two-package monorepo with no shared package
(per `CLAUDE.md`, models are required ad-hoc; duplication is the established
norm). The design panel needs the *display* lists (layout ids, font-pair names,
density/heading enums). To keep the server the single source of truth without a
build-time shared module, expose a tiny read endpoint
`GET /api/resume-builder/design-system` returning the catalog's public lists; the
client fetches it once and caches it. `buildPalette` / `validateDesign` logic stays
server-only and is never shipped to the client.

### 6.3 `ResumeRenderer` (`client/src/components/resume/ResumeRenderer.jsx`)

Replaces the 3 hardcoded branches in `ResumePreview.jsx`. Signature mirrors the
current preview so call sites barely change:

```jsx
<ResumeRenderer design={design} form={form}
                 editable onEdit={handleSectionEdit} highlighted={changed} />
```

- Maps `design.palette` → CSS custom properties on the sheet root
  (`--rb-primary`, `--rb-accent`, `--rb-text`, …).
- Maps `design.fonts` → `--rb-font-heading` / `--rb-font-body`.
- Renders the chosen `layout` via a small set of layout components
  (`SingleColumn`, `Sidebar`, `HeaderBand`, `TwoColumn`, …) that all consume the
  same `Section` / field primitives.
- Honors `sectionOrder` + `hidden`.
- **Preserves the existing `Editable` click-to-edit** (path-based: `experience.2.description`)
  across every layout — this is a hard requirement, since edit-in-place must keep
  working regardless of layout.
- The rendered node keeps `id="resume-preview"` so the existing PDF path still
  targets it.

`ResumePreview.jsx` is kept as a thin wrapper that maps legacy `template` →
`design` and delegates to `ResumeRenderer`, so nothing that imports it breaks.

### 6.4 Fonts

Bundle the curated font families (self-hosted via `@fontsource` packages on the
client) so the preview and the PDF render identically offline and there's no
runtime dependency on Google Fonts CDN. DOCX ignores fonts (ATS-plain).

---

## 7. Pillar 2 — Conversational intake copilot

### 7.1 UX

The Resume Builder's primary "new resume" entry becomes a **chat**, not the
profile-pull card. The copilot:

1. Silently loads the user's profile (same fields as today's
   `/drafts/generate`).
2. Greets, states what it already knows, and asks **one question at a time** for
   gaps ("What role are you targeting?", "Tell me about your most recent job —
   what did you actually ship?", "Any metrics you're proud of?").
3. When it judges it has enough, it **generates content + a design spec**,
   persists a `ResumeDraft`, and the UI flips from chat → the visual editor with
   the finished resume.

### 7.2 Server (`server/agent/services/resumeIntake.js` + route)

A focused agent loop that **reuses the `runAgent` pattern** (bounded iterations,
`sanitizeMessages`, prompt-injection guard, `llm.chat`) but with a resume-intake
system prompt and two tools:

- `update_resume_facts(partial)` — accumulates gathered content (read-style; no
  DB write yet).
- `finalize_resume({ content, design })` — the "ready" signal. Server runs
  `shapeDraft(content)` + `validateDesign(design)` + the **anti-invention guard**
  (no employers/degrees/projects beyond what was provided), then `ResumeDraft.create`.

Endpoint: `POST /api/resume-builder/intake` with `{ messages, draftId? }` →
returns either `{ reply }` (next question) or `{ draft }` (finished). Streaming
optional (reuse `runAgentStream` / SSE) but **not required for v1**.

### 7.3 Guardrails

- The existing "treat pasted content as DATA, never instructions" injection guard
  carries over verbatim.
- The anti-invention guard from `refineDraft`/`tailorDraft` is reused on
  `finalize_resume`.
- Conversation transcript is **client-held** for v1 (only the resulting draft
  persists). Resumable intake is deferred.

---

## 8. Pillar 3 — Editing (NL + structured visual)

### 8.1 Natural-language edits (content *and* design)

Extend the existing refine flow so an instruction can target **content** or
**design**. The LLM returns a patch that names which it changed:

- Content edits → existing `refineDraft` path (unchanged, with its guards).
- Design edits ("make it teal", "two columns", "more whitespace", "put skills in
  a sidebar") → a new `refineDesign` that returns a **design spec patch**, run
  through `validateDesign`, persisted, and snapshotted as a revision (so design
  changes are undoable too — reuses the existing `revisions` machinery).

A single NL box routes to the right path; the server decides based on the model's
classification, defaulting to content when ambiguous.

### 8.2 Structured visual editor (the "Canva feel")

A **Design panel** beside the live preview:

- **Palette** — color pickers bound to each palette token + a "regenerate
  palette" button + a vibe prompt ("warm", "ocean", "cyberpunk") → `buildPalette`.
- **Fonts** — pick from the curated `FONT_PAIRS`.
- **Layout** — switch archetype (instant re-render).
- **Density** — compact / normal / roomy.
- **Sections** — drag to reorder, toggle show/hide (writes `sectionOrder` /
  `hidden`).
- **"Regenerate design"** — asks the AI for a fresh spec; **content untouched**.

Every control writes through the existing `PATCH /drafts/:id/section`-style
mechanism (extended with a `design.*` whitelist) so edits persist immediately and
optimistically, exactly like today's click-to-edit. **In-place text editing is
unchanged** and must keep working across all layouts (tested explicitly).

---

## 9. Export

The current code has **two** PDF paths and *neither* is "beautiful + selectable":
the client `html2pdf` ([ResumeBuilder.jsx:377](../../../client/src/pages/ResumeBuilder.jsx#L377))
screenshots the DOM at `scale:2` → a **raster image** (text not selectable; and
html2canvas clips colored header-bands / shifts columns at page breaks — exactly
the layouts we're betting on); the server `pdfkit`
([document.js:95](../../../server/agent/services/document.js#L95)) is selectable
but **flat** (ignores all design). Decision:

- **PDF = full design fidelity via server headless-Chrome (Puppeteer).** A new
  resume-PDF path renders the designed page with real Chrome and `page.pdf()`,
  producing a **faithful, selectable-text** PDF. This handles any CSS (sidebars,
  two-column, background bands) correctly, and is **one renderer** — no hand-drawn
  second engine to keep in sync.
  - **Parity strategy (avoid a divergent second renderer):** a server
    `resumeHtml(design, content)` emits a complete HTML document whose
    design-token→CSS mapping is the *same mapping* the client `ResumeRenderer`
    uses (kept as a shared CSS-builder string, not re-implemented). Puppeteer
    `setContent(html)` + bundled `@font-face` so fonts match the preview, then
    `page.pdf({ printBackground: true, preferCSSPageSize: true })`.
  - **Ops note:** this intentionally supersedes the "No headless Chrome" comment
    in `document.js` *for the resume PDF only*. Use `puppeteer-core` + a pinned
    Chromium (or the bundled `puppeteer`); launch a **single shared browser
    instance** (not per-request) to bound memory/cold-start. The generic
    `generateDocument` pdfkit path stays as-is for DOCX/`md`/other docs.
  - **Future upgrade (noted, not v1):** point Puppeteer at a chrome-less client
    print route (`/print/resume/:id`) to render the *exact* React component for
    pixel-perfect parity.
- **DOCX = ATS-plain extraction.** Keep the existing server flat path
  (`_buildResumeSections` → `generateDocument`); clean, single-column,
  recruiter-parser-safe `.docx`. **Design tokens are intentionally ignored** for
  DOCX — this is the ATS-safe download.
- The UI labels them clearly: **"PDF (designed)"** vs **"DOCX (ATS-friendly)"** so
  the user understands the tradeoff and never ships an unparseable resume to an ATS.

## 10. Cover letter (v1)

- The intake chat can also produce a cover letter (content) on request, reusing
  the existing `/cover-letter` generation.
- Rendered with a **lightweight design**: same palette + heading font as the
  resume, single-column. No separate layout archetypes for cover letters in v1.
- Export: PDF (designed, matching the resume) + DOCX (plain).

## 11. Security & guardrails (carried over)

- AI emits **structured tokens**, never HTML/CSS → no injected-markup XSS.
- `validateDesign` clamps every field to the catalog; bad hex/layout repaired.
- Anti-invention guard on all generation/refine paths.
- Prompt-injection guard (pasted text = data) on the intake loop.
- All routes stay behind `protect`; ownership checked by `user` on every draft.
- Response shape stays `{ success, ... }`; new client calls go through
  `services/api.js` (no direct axios), per `CLAUDE.md`.

## 12. Testing strategy

No test runner is configured. Follow the repo's existing **headless verify-script**
pattern (e.g. `server/seeds/verifyP3ResumeCanvas.js`, referenced by recent
`test(...)` commits):

- `verifyDesignSystem.js` — `validateDesign` repairs junk specs; `buildPalette`
  meets contrast; legacy `template` → `design` mapping is stable.
- `verifyResumeIntake.js` — a stubbed-LLM intake run asks ≥1 question then
  finalizes; `finalize_resume` rejects invented employers; produced draft passes
  `shapeDraft` + `validateDesign`.
- `verifyResumeRender.js` — render snapshot for each layout archetype; click-to-edit
  path targeting holds across layouts; `#resume-preview` id present.
- Manual: generate → edit (NL + visual) → export PDF/DOCX round-trip.

**Visual gate (the failure mode logic tests can't see).** Logic verify-scripts go
green while a resume *looks* broken or a PDF clips — the very thing that reproduces
"it's shit." So the plan must add a **screenshot-based visual check** using the
available `chrome-devtools` / `playwright` MCP tools:

- Render each archetype with realistic sample content; screenshot the live
  preview **and** the Puppeteer PDF (rasterized) and eyeball both — no header-band
  clipping, no column drift, no overflow off the page.
- A per-archetype **PDF round-trip** is a release gate: every archetype must
  export cleanly before it ships. An archetype that fails the visual gate is cut,
  not shipped.

## 13. Rollout (within the one combined spec)

Implementation order (each independently verifiable):

1. **Renderer + design system + data model + Puppeteer PDF spike** (keystone).
   Build the renderer *and* the Puppeteer PDF path together with **one or two
   archetypes first**, and run the §12 visual gate immediately — because PDF
   fidelity decides which archetypes are viable, this spike comes **first**, not
   last. Only after PDF round-trips cleanly do we build out the rest of the
   archetypes. Existing generate/refine keep working, now rendering via tokens;
   legacy drafts map cleanly.
2. **Intake copilot** — chat entry that produces `{ content, design }`.
3. **Editing** — design panel + NL design edits + export labels.
4. **Cover letter** — matching-design letter + export.

## 14. Open questions / risks

- **Layout count vs. quality.** Start with ~5–6 archetypes; adding more is cheap
  later. Risk: too few feels repetitive; too many dilutes polish. Mitigation: ship
  5–6 strong ones, expand based on use.
- **Chromium dependency / resource cost.** Puppeteer adds a Chromium runtime to
  the server (deploy weight, memory, cold-start). Mitigation: pin the version,
  launch a single shared browser instance reused across requests, cap concurrent
  PDF renders, and fail soft (offer DOCX) if the browser is unavailable. The PDF
  path is the one new infra dependency — call it out in deploy docs / `.env`.
- **HTML/React parity drift.** The server `resumeHtml()` emitter and the client
  `ResumeRenderer` could diverge. Mitigation: share the design-token→CSS builder
  string; the §12 visual round-trip (preview vs PDF screenshot) is the guard. The
  noted future upgrade (Puppeteer prints the real client print route) removes the
  second emitter entirely.
- **Intake length.** The chat must not interrogate forever. Mitigation: the system
  prompt caps essential questions and offers "generate now with what we have" early.
- **Font bundle size.** ~10–12 families self-hosted adds weight. Mitigation: subset
  to Latin + the weights actually used; lazy-load per selected pair.
```