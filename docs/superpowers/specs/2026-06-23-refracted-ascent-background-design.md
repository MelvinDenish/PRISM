# Refracted Ascent — cinematic WebGL background

**Date:** 2026-06-23
**Status:** Approved design (pending spec review)
**Surface:** PRISM client (`client/`)

## Summary

Replace the current CSS-blob `AuroraBackground` with a real-time WebGL
fragment-shader background, **"Refracted Ascent."** It renders a cinematic,
"video-quality" volumetric light field that expresses PRISM's motto — *"Refract
your potential into a placement"* — as a complete visual arc: a soft beam of
potential **refracts** into a gold→amber→cool spectrum, and those spectral
streams **rise and converge** toward a luminous focal point (the placement /
outcome). No literal glass-prism graphic.

It is a drop-in replacement: same `variant` API, same z-index / layering
contract, same reduced-motion respect, plus full graceful degradation when
WebGL is unavailable. No new npm dependencies (raw WebGL).

## Goals

- Cinematic, 3D-feeling, professional background on the surfaces that currently
  show the aurora (auth pages, 404, in-app pages).
- On-brand and meaningful: refraction → ascent → convergence, in the warm
  gold/amber palette, theme-aware (dark + light).
- Lightweight and safe: capped cost, pauses when not visible, static fallback.

## Non-goals (YAGNI)

- No Three.js / `@react-three/fiber` or any new dependency.
- No literal prism/triangle illustration.
- No landing-page or marketing redesign — only surfaces that already render the
  aurora today.
- No actual video file (`.mp4`/`.webm`).

## Concept — what the shader draws

A single full-screen fragment shader composites, bottom-to-top:

1. **Beam of potential** — a soft vertical shaft of light entering from the
   lower region.
2. **Refraction / dispersion** — the beam splits into layered spectral bands:
   gold (`--accent-primary`) → amber/burnt-orange (`--accent-tertiary`) → a
   derived **cool accent** (the palette is warm-only, so the cool end of the
   spectrum is computed, e.g. a desaturated teal/indigo ~`#2E6E73`/`#3A4E8C`,
   tuned for harmony — exact value chosen during implementation).
3. **Ascent + convergence** — fbm/noise-driven spectral streams flow upward and
   lean toward a focal point near the top.
4. **Bloom focal point** — a soft glow where streams converge, pulsing slowly
   (the "goal" / placement).
5. **Depth/parallax layers** — three noise strata at different scales/speeds for
   volumetric depth (the "3D" read).
6. **Rising motes** — fine spectral particles lifting upward (momentum/texture).

All procedural ("fake-volumetric") math in one fragment shader — the standard
cheap path to this class of look. No geometry beyond a full-screen quad.

## Component design

New component `RefractedAscent` — a drop-in replacement for `AuroraBackground`.

**Files**
- Add `client/src/components/RefractedAscent.jsx`
- Add `client/src/components/RefractedAscent.css`
- Edit `client/src/components/AuthLayout.jsx` — swap import + usage
- Edit `client/src/components/Layout.jsx` — swap import + usage
- Edit `client/src/pages/NotFound.jsx` — swap import + usage
- Remove `client/src/components/AuroraBackground.jsx` and
  `client/src/components/AuroraBackground.css` (fully superseded)

**Public API** (identical shape to current usage):
```jsx
<RefractedAscent variant="hero" />   // auth pages, 404
<RefractedAscent variant="app" />    // in-app pages (default)
```

**Markup / layering contract** (unchanged from aurora):
- Root `<div>` is `position:fixed; inset:0; z-index:-1; pointer-events:none;`
  `aria-hidden="true"`, `contain: strict`. Sitting at `z-index:-1` (NOT a
  positive z-index on main content) is required so fixed modals are not trapped
  beneath the sidebar — same reasoning documented in `AuroraBackground.css`.
- Contains a `<canvas>` (the WebGL surface) and a CSS static-fallback layer.

**Variants**
- `hero` — auth + 404: full effect, all six layers, parallax on, brightest
  opacity, uncapped to display refresh (still DPR-capped).
- `app` — in-app pages: same shader **dialed down** — lower opacity, ~30fps
  cap, motes and cursor/scroll parallax off, faint bloom — so dense content
  (dashboards, tables, code) stays readable and battery cost stays low.

### WebGL implementation

- Vertex shader: trivial full-screen quad (two triangles).
- Fragment shader: the composition above.
- **Uniforms:** `u_time`, `u_resolution`, `u_dpr`, `u_mouse` (normalized,
  eased), `u_scroll` (normalized, eased), `u_intensity` (variant-driven), and
  spectral colors `u_colorPotential`, `u_colorGold`, `u_colorAmber`,
  `u_colorCool`, `u_bg` — all read from live CSS custom properties via
  `getComputedStyle` so the effect matches the active theme.
- **Render loop:** `requestAnimationFrame`. Time accumulates; mouse/scroll
  values are eased toward targets for smooth parallax.
- **Theme reactivity:** re-read CSS-var colors via a `MutationObserver` watching
  the `data-theme` attribute on the document root (the app toggles theme there);
  on change, update the color uniforms in place without remounting the canvas.

### Performance & graceful degradation (hard requirements)

1. **Capability gate.** On mount, attempt to get a WebGL context. If WebGL is
   unavailable, the context is lost, or `prefers-reduced-motion: reduce` is set,
   **do not start any animation loop** — render only the static CSS fallback.
2. **Static fallback.** A CSS-only gradient (in `RefractedAscent.css`) baked
   from the same palette — a still "refracted ascent" gradient. This is what
   reduced-motion / no-WebGL / low-power users see. No JS animation.
3. **DPR cap** at ~1.5 to bound fragment work on high-density displays.
4. **Visibility pausing:** stop the RAF loop on `document.hidden`
   (`visibilitychange`) and when the element is scrolled out of view
   (`IntersectionObserver`); resume on return.
5. **Throttle:** `app` variant caps to ~30fps; `hero` runs to display refresh.
6. **Context-loss handling:** listen for `webglcontextlost` → fall back to the
   static layer; attempt restore on `webglcontextrestored`.
7. **Cleanup:** cancel RAF, remove listeners, delete GL program/buffers on
   unmount.

## Data flow

```
CSS custom properties (theme)  ─┐
prefers-reduced-motion          ├─> RefractedAscent (capability gate)
WebGL availability             ─┘        │
                                         ├─ supported -> <canvas> RAF shader loop
                                         │     uniforms <- time, mouse, scroll, theme colors, intensity
                                         │     paused when hidden / offscreen
                                         └─ unsupported / reduced-motion -> static CSS gradient layer
```

Inputs are read-only ambient signals (theme, pointer, scroll, visibility). The
component owns no app state and emits no events — it is a pure visual layer,
identical in responsibility to the aurora it replaces.

## Error handling

- Shader compile/link failure → log once (dev only), fall back to static layer.
- `getContext('webgl')` null → static layer.
- Context lost at runtime → static layer; try restore.
- All failures are silent to the user (it is decorative); the page never breaks.

## Testing / verification

No test runner is configured in the client (per CLAUDE.md). Verification is
manual + build:
- `npm run build` and `npm run lint` in `client/` pass.
- Visual check: auth (`/login`, `/register`), `/404`, and an in-app page in both
  light and dark themes.
- Reduced-motion check (OS setting / DevTools emulation): static gradient only,
  no canvas animation.
- WebGL-off check (disable WebGL in DevTools): static fallback renders, no
  errors.
- Modal layering regression: open a modal over an in-app page; confirm it is not
  trapped behind the sidebar (the z-index:-1 contract).

## Acceptance criteria

- [ ] `RefractedAscent` renders the animated effect on `/login`, `/register`,
      404, and in-app pages, theme-aware in light + dark.
- [ ] `hero` is bold; `app` is quiet/readable and throttled.
- [ ] Reduced-motion and no-WebGL both yield the static gradient with zero JS
      animation and no console errors.
- [ ] Loop pauses when tab hidden / element offscreen.
- [ ] No new npm dependency; `AuroraBackground` removed; build + lint green.
- [ ] z-index / pointer-events / aria contract unchanged from the aurora.
