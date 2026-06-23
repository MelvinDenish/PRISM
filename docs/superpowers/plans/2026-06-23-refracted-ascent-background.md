# Refracted Ascent Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS-blob `AuroraBackground` with a real-time WebGL fragment-shader background ("Refracted Ascent") on the auth pages, 404, and in-app pages.

**Architecture:** One self-contained React component renders a full-screen `<canvas>` driving a single GLSL fragment shader (raw WebGL, full-screen quad — no Three.js). A capability gate falls back to a static CSS gradient when WebGL is unavailable or `prefers-reduced-motion` is set. Two intensity variants (`hero`, `app`) reuse the same shader. Theme colors are read from live CSS custom properties.

**Tech Stack:** React 19, raw WebGL 1 (no new deps), Vite, plain CSS.

## Global Constraints

- No new npm dependencies — raw WebGL only (`client/package.json` stays unchanged).
- CommonJS is server-only; this is client ESM (`import`/`export`).
- Layering contract is fixed: root is `position:fixed; inset:0; z-index:-1; pointer-events:none; aria-hidden="true"` — z-index MUST be `-1` (not a positive z-index on main content) so fixed modals are not trapped beneath the sidebar.
- Respect `prefers-reduced-motion: reduce` — no animation loop when set.
- Theme is toggled via the `data-theme` attribute on `document.documentElement`; colors come from CSS vars `--bg-primary` (#0E0E11 dark / #FAF7F0 light), `--accent-primary` (gold), `--accent-tertiary` (burnt orange). The cool spectral end is a derived constant `vec3(0.18, 0.43, 0.45)`.
- Verification per task = `npm run build` + `npm run lint` in `client/` both green, plus the task's manual visual check. No unit-test runner exists in the client.
- All commands run from `client/`.

---

### Task 1: Component shell + static CSS fallback + capability gate

**Files:**
- Create: `client/src/components/RefractedAscent.jsx`
- Create: `client/src/components/RefractedAscent.css`
- Modify: `client/src/pages/NotFound.jsx` (swap one usage for verification)

**Interfaces:**
- Consumes: nothing.
- Produces: `RefractedAscent` default export, props `{ variant?: 'hero' | 'app' }` (default `'app'`). Renders root `<div class="refracted-ascent refracted-ascent--{variant}">` containing `<canvas class="refracted-ascent__canvas" />`. In this task the canvas stays blank; only the CSS fallback gradient is visible.

- [ ] **Step 1: Create the CSS** — static fallback gradient + layering contract.

`client/src/components/RefractedAscent.css`:
```css
/* Refracted Ascent — WebGL background with a static CSS fallback.
   z-index:-1 keeps it behind content WITHOUT trapping fixed modals. */
.refracted-ascent {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  contain: strict;
  /* Static fallback: a baked "refracted ascent" gradient (warm -> cool, rising). */
  background:
    radial-gradient(60% 50% at 50% 8%, rgba(201, 162, 75, 0.30), transparent 70%),
    radial-gradient(70% 60% at 30% 90%, rgba(226, 104, 42, 0.22), transparent 72%),
    radial-gradient(80% 70% at 75% 80%, rgba(46, 110, 115, 0.16), transparent 74%),
    var(--bg-primary, #0E0E11);
}
.refracted-ascent__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
/* app variant: quieter so dense content stays readable */
.refracted-ascent--app .refracted-ascent__canvas { opacity: 0.5; }
.refracted-ascent--hero .refracted-ascent__canvas { opacity: 1; }
/* When WebGL is unavailable the canvas is hidden and the gradient above shows. */
.refracted-ascent.is-fallback .refracted-ascent__canvas { display: none; }
.refracted-ascent--app.is-fallback { opacity: 0.5; }

@media (prefers-reduced-motion: reduce) {
  /* JS already skips the loop; this guards against any canvas paint flash. */
  .refracted-ascent__canvas { display: none; }
}
```

- [ ] **Step 2: Create the component shell** with the capability gate.

`client/src/components/RefractedAscent.jsx`:
```jsx
import { useEffect, useRef } from 'react';
import './RefractedAscent.css';

/**
 * RefractedAscent — cinematic WebGL background.
 * variant="hero" → auth / 404 (full effect). variant="app" → in-app (quiet).
 * Falls back to a static CSS gradient when WebGL is unavailable or the user
 * prefers reduced motion. Sits at z-index:-1, pointer-events:none.
 */
const RefractedAscent = ({ variant = 'app' }) => {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = reduced
      ? null
      : canvas.getContext('webgl', {
          antialias: false,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: 'low-power',
        });

    if (!gl) {
      root.classList.add('is-fallback'); // show static gradient
      return;
    }
    // WebGL bootstrap lands in Task 2.
  }, [variant]);

  return (
    <div ref={rootRef} className={`refracted-ascent refracted-ascent--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="refracted-ascent__canvas" />
    </div>
  );
};

export default RefractedAscent;
```

- [ ] **Step 3: Swap NotFound to use it** (low-risk verification surface).

In `client/src/pages/NotFound.jsx`, replace the `AuroraBackground` import and its JSX usage with `RefractedAscent`:
```jsx
import RefractedAscent from '../components/RefractedAscent';
// ...
<RefractedAscent variant="hero" />
```
(Leave `AuroraBackground` imports in `AuthLayout.jsx` and `Layout.jsx` untouched until Task 5.)

- [ ] **Step 4: Build + lint.**

Run: `npm run build && npm run lint`
Expected: both succeed, no errors.

- [ ] **Step 5: Manual visual check.**

Run `npm run dev`, open `/some-nonexistent-route` (renders NotFound). Expected: a warm→cool baked gradient fills the background in both light and dark themes (toggle theme). No console errors.

- [ ] **Step 6: Commit.**

```bash
git add client/src/components/RefractedAscent.jsx client/src/components/RefractedAscent.css client/src/pages/NotFound.jsx
git commit -m "feat(client): RefractedAscent shell + static fallback + capability gate"
```

---

### Task 2: WebGL bootstrap — quad, RAF loop, lifecycle safety

**Files:**
- Modify: `client/src/components/RefractedAscent.jsx`

**Interfaces:**
- Consumes: the component shell + `gl` context from Task 1.
- Produces: a running RAF loop that compiles a vertex shader + a placeholder fragment shader, draws a full-screen quad, handles DPR-capped resize, pauses on `visibilitychange` and `IntersectionObserver`, handles `webglcontextlost`/`restored`, and cleans up on unmount. Exposes (internally) the helper `compile(gl, type, src)` and `buildProgram(gl, vert, frag)` and uniform-location lookups reused by Task 3.

- [ ] **Step 1: Add shader source constants + GL helpers** at module top of `RefractedAscent.jsx` (above the component):

```jsx
const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Placeholder fragment — replaced by the full shader in Task 3.
const FRAG = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float g = 0.5 + 0.5 * sin(u_time * 0.5 + uv.y * 6.2831);
  gl_FragColor = vec4(vec3(0.10, 0.08, 0.06) + g * vec3(0.5, 0.35, 0.1) * uv.y, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('RefractedAscent shader error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function buildProgram(gl, vertSrc, fragSrc) {
  const v = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const f = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.warn('RefractedAscent link error:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}
```

- [ ] **Step 2: Replace the `useEffect` body** (after the capability gate) with the full WebGL lifecycle:

```jsx
    const program = buildProgram(gl, VERT, FRAG);
    if (!program) { root.classList.add('is-fallback'); return; }

    // Full-screen quad (TRIANGLE_STRIP).
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');

    const U = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
    };

    const DPR_CAP = 1.5;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    let raf = 0, running = true, visible = true, start = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!running || !visible) return;
      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.resolution, canvas.width, canvas.height);
      gl.uniform1f(U.time, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    raf = requestAnimationFrame(frame);

    const onVis = () => { running = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(root);

    const onLost = (e) => { e.preventDefault(); running = false; root.classList.add('is-fallback'); };
    const onRestored = () => { root.classList.remove('is-fallback'); running = true; };
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
```

- [ ] **Step 3: Build + lint.**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Manual visual check.** `npm run dev`, open the 404 route. Expected: an animated warm gradient pulses on the canvas. Switch browser tabs and back — the animation pauses while hidden (no stutter on return). No console errors.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/RefractedAscent.jsx
git commit -m "feat(client): RefractedAscent WebGL bootstrap, RAF loop, lifecycle safety"
```

---

### Task 3: The Refracted Ascent fragment shader + theme palette uniforms

**Files:**
- Modify: `client/src/components/RefractedAscent.jsx`

**Interfaces:**
- Consumes: `compile`/`buildProgram`, the `U` uniform map and RAF loop from Task 2.
- Produces: the final `FRAG` (beam → refraction spectrum → ascent/convergence → bloom → depth layers → motes), the `readPalette()` helper returning normalized RGB triples, color uniforms wired each frame, and a `MutationObserver` on `data-theme` that refreshes the cached palette.

- [ ] **Step 1: Replace the placeholder `FRAG` constant** with the full shader:

```glsl
precision highp float;
uniform vec2  u_resolution;
uniform float u_time;
uniform vec2  u_mouse;     // -1..1, eased
uniform float u_scroll;    // 0..1, eased
uniform float u_intensity; // variant master (0..1)
uniform float u_motes;     // 0 or 1
uniform float u_parallax;  // 0 or 1
uniform vec3  u_bg;
uniform vec3  u_gold;
uniform vec3  u_amber;
uniform vec3  u_cool;
uniform vec3  u_potential;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.,0.)), c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 res = u_resolution;
  vec2 uv = gl_FragCoord.xy / res;                 // 0..1
  vec2 p  = (gl_FragCoord.xy - 0.5 * res) / res.y; // aspect-correct, center 0

  float t = u_time * 0.06;
  vec2  par = u_mouse * 0.06 * u_parallax;
  float climb = uv.y;
  float focalX = u_mouse.x * 0.04 * u_parallax;

  // three rising depth layers, leaning toward the focal column as they climb
  float light = 0.0, spectrum = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float depth = 0.5 + fi * 0.5;
    float speed = 0.4 + fi * 0.35;
    vec2 q = p + par * (0.4 + fi * 0.5);
    q.x = mix(q.x, focalX, climb * 0.45);
    vec2 fp = q * vec2(1.6, 1.1) * depth;
    fp.y += t * speed * 3.0 + u_scroll * 1.5;
    float n = fbm(fp + fbm(fp * 0.5 + t));
    float stream = smoothstep(0.45, 0.95, n);
    float w = 1.0 / (1.0 + fi * 0.6);
    light += stream * w;
    spectrum += n * w;
  }
  light /= 2.0;

  // beam of potential entering at the bottom-center
  float beam = smoothstep(0.18, 0.0, abs(p.x - focalX))
             * smoothstep(1.0, 0.0, uv.y)
             * smoothstep(0.0, 0.25, uv.y);
  light += beam * 0.5;

  // dispersion: spectral color across the horizontal axis + noise
  float s = clamp(p.x * 0.8 + spectrum * 0.5 + 0.5, 0.0, 1.0);
  vec3 spec = mix(u_gold, u_amber, smoothstep(0.0, 0.5, s));
  spec = mix(spec, u_cool, smoothstep(0.5, 1.0, s));
  spec = mix(spec, u_potential, beam * 0.6);

  // bloom focal point near the top-center (the goal), slow pulse
  vec2 focal = vec2(focalX, 0.30);
  float fd = length((p - focal) * vec2(1.0, 1.3));
  float pulse = 0.85 + 0.15 * sin(u_time * 0.6);
  float bloom = smoothstep(0.6, 0.0, fd) * pulse;
  light += bloom * 0.7;
  spec = mix(spec, u_potential, bloom * 0.4);

  // rising motes
  float motes = 0.0;
  if (u_motes > 0.01){
    vec2 mp = p * vec2(8.0, 6.0);
    mp.y += t * 6.0;
    vec2 gid = floor(mp), gf = fract(mp) - 0.5;
    float h = hash(gid);
    float tw = 0.5 + 0.5 * sin(u_time * 2.0 + h * 30.0);
    motes = smoothstep(0.12, 0.0, length(gf)) * step(0.82, h) * tw;
  }
  light += motes * u_motes * 0.8;

  // compose: lift the base background toward the spectrum by accumulated light
  vec3 col = mix(u_bg, spec, clamp(light, 0.0, 1.0));
  col += spec * light * 0.4;                 // additive glow
  col = mix(u_bg, col, u_intensity);          // master intensity

  float vig = smoothstep(1.2, 0.2, length(p));
  col *= 0.85 + 0.15 * vig;

  gl_FragColor = vec4(col, 1.0);
}
```

- [ ] **Step 2: Add the palette reader** at module top (above the component):

```jsx
function hexToRgb(hex, fallback) {
  const h = (hex || '').trim().replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (v.length !== 6) return fallback;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return fallback;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fb) => hexToRgb(cs.getPropertyValue(name), fb);
  return {
    bg: v('--bg-primary', [0.055, 0.055, 0.067]),
    gold: v('--accent-primary', [0.788, 0.635, 0.294]),
    amber: v('--accent-tertiary', [0.886, 0.408, 0.165]),
    cool: [0.18, 0.43, 0.45],          // derived cool spectral end
    potential: [1.0, 0.97, 0.9],
  };
}
```

- [ ] **Step 3: Extend the `U` uniform map** (after the existing `resolution`/`time` entries) and cache the palette:

```jsx
    U.mouse = gl.getUniformLocation(program, 'u_mouse');
    U.scroll = gl.getUniformLocation(program, 'u_scroll');
    U.intensity = gl.getUniformLocation(program, 'u_intensity');
    U.motes = gl.getUniformLocation(program, 'u_motes');
    U.parallax = gl.getUniformLocation(program, 'u_parallax');
    U.bg = gl.getUniformLocation(program, 'u_bg');
    U.gold = gl.getUniformLocation(program, 'u_gold');
    U.amber = gl.getUniformLocation(program, 'u_amber');
    U.cool = gl.getUniformLocation(program, 'u_cool');
    U.potential = gl.getUniformLocation(program, 'u_potential');

    let palette = readPalette();
    const themeObserver = new MutationObserver(() => { palette = readPalette(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
```

- [ ] **Step 4: Set the color + static uniforms inside `frame()`** (after the existing `u_time` line). Use constant defaults for now — variant wiring is Task 4:

```jsx
      gl.uniform2f(U.mouse, 0, 0);
      gl.uniform1f(U.scroll, 0);
      gl.uniform1f(U.intensity, 1.0);
      gl.uniform1f(U.motes, 1.0);
      gl.uniform1f(U.parallax, 0.0);
      gl.uniform3fv(U.bg, palette.bg);
      gl.uniform3fv(U.gold, palette.gold);
      gl.uniform3fv(U.amber, palette.amber);
      gl.uniform3fv(U.cool, palette.cool);
      gl.uniform3fv(U.potential, palette.potential);
```

- [ ] **Step 5: Add `themeObserver.disconnect();`** to the cleanup return block (alongside `io.disconnect()`).

- [ ] **Step 6: Build + lint.** Run: `npm run build && npm run lint`. Expected: both succeed.

- [ ] **Step 7: Manual visual check.** `npm run dev`, open the 404 route. Expected: the cinematic refracted-ascent effect — a warm spectral field rising to a soft bloom near the top. Toggle theme: the background base color follows the theme. No console errors (no shader-compile warnings).

- [ ] **Step 7b: If the shader logs a compile/link warning**, the component shows the static fallback instead — read the dev-console message, fix the GLSL, and repeat Step 6.

- [ ] **Step 8: Commit.**

```bash
git add client/src/components/RefractedAscent.jsx
git commit -m "feat(client): full Refracted Ascent shader + theme-aware palette uniforms"
```

---

### Task 4: Variant system + cursor/scroll parallax

**Files:**
- Modify: `client/src/components/RefractedAscent.jsx`

**Interfaces:**
- Consumes: the shader + uniform wiring from Task 3.
- Produces: a `VARIANTS` config map driving `intensity`/`fps`/`motes`/`parallax`; eased `u_mouse`/`u_scroll` from real pointer + scroll input (hero only); an fps throttle for the `app` variant. Pointer/scroll listeners are skipped entirely when `parallax` is 0 or under reduced-motion.

- [ ] **Step 1: Add the variant config** at module top:

```jsx
const VARIANTS = {
  hero: { intensity: 1.0, motes: 1.0, parallax: 1.0, fps: 0 },   // fps 0 = display refresh
  app:  { intensity: 0.55, motes: 0.0, parallax: 0.0, fps: 30 },
};
```

- [ ] **Step 2: Inside the effect**, after the capability gate, resolve the config and parallax state:

```jsx
    const cfg = VARIANTS[variant] || VARIANTS.app;
    const target = { mx: 0, my: 0, scroll: 0 };
    const eased = { mx: 0, my: 0, scroll: 0 };

    let onMove, onScroll;
    if (cfg.parallax > 0) {
      onMove = (e) => {
        target.mx = (e.clientX / window.innerWidth) * 2 - 1;
        target.my = (e.clientY / window.innerHeight) * 2 - 1;
      };
      onScroll = () => {
        const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
        target.scroll = Math.min(1, window.scrollY / max);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }
```

- [ ] **Step 3: Replace the constant uniform lines from Task 3 Step 4** with eased + variant-driven values, and add fps throttling. The `frame(now)` body becomes:

```jsx
    const minDelta = cfg.fps > 0 ? 1000 / cfg.fps : 0;
    let last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!running || !visible) return;
      if (minDelta && now - last < minDelta) return;
      last = now;

      eased.mx += (target.mx - eased.mx) * 0.05;
      eased.my += (target.my - eased.my) * 0.05;
      eased.scroll += (target.scroll - eased.scroll) * 0.05;

      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.resolution, canvas.width, canvas.height);
      gl.uniform1f(U.time, (now - start) / 1000);
      gl.uniform2f(U.mouse, eased.mx, eased.my);
      gl.uniform1f(U.scroll, eased.scroll);
      gl.uniform1f(U.intensity, cfg.intensity);
      gl.uniform1f(U.motes, cfg.motes);
      gl.uniform1f(U.parallax, cfg.parallax);
      gl.uniform3fv(U.bg, palette.bg);
      gl.uniform3fv(U.gold, palette.gold);
      gl.uniform3fv(U.amber, palette.amber);
      gl.uniform3fv(U.cool, palette.cool);
      gl.uniform3fv(U.potential, palette.potential);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
```

(Delete the earlier `frame` definition from Task 2 so only this one remains.)

- [ ] **Step 4: Add listener cleanup** to the return block:

```jsx
      if (onMove) window.removeEventListener('pointermove', onMove);
      if (onScroll) window.removeEventListener('scroll', onScroll);
```

- [ ] **Step 5: Build + lint.** Run: `npm run build && npm run lint`. Expected: both succeed.

- [ ] **Step 6: Manual visual check.** `npm run dev`. On the 404 route (`variant="hero"`): moving the mouse subtly shifts the field's perspective; the effect is bold. Temporarily render `<RefractedAscent variant="app" />` somewhere (or wait for Task 5) to confirm the app variant is dimmer, has no motes, and ignores the mouse. No console errors.

- [ ] **Step 7: Commit.**

```bash
git add client/src/components/RefractedAscent.jsx
git commit -m "feat(client): RefractedAscent variants + cursor/scroll parallax + fps throttle"
```

---

### Task 5: Swap remaining usages + remove AuroraBackground

**Files:**
- Modify: `client/src/components/AuthLayout.jsx`
- Modify: `client/src/components/Layout.jsx`
- Delete: `client/src/components/AuroraBackground.jsx`
- Delete: `client/src/components/AuroraBackground.css`

**Interfaces:**
- Consumes: the finished `RefractedAscent` component.
- Produces: no remaining references to `AuroraBackground` anywhere in the client.

- [ ] **Step 1: Update AuthLayout.** In `client/src/components/AuthLayout.jsx`, replace `import AuroraBackground from './AuroraBackground';` with `import RefractedAscent from './RefractedAscent';` and change `<AuroraBackground variant="hero" />` to `<RefractedAscent variant="hero" />`.

- [ ] **Step 2: Update Layout.** In `client/src/components/Layout.jsx`, replace the `AuroraBackground` import with `import RefractedAscent from './RefractedAscent';` and change the `<AuroraBackground ... />` usage to `<RefractedAscent variant="app" />` (preserve whatever variant prop it currently passes — use `app` if it was the default/app wash).

- [ ] **Step 3: Confirm no references remain.**

Run: `git grep -n "AuroraBackground" client/src` 
Expected: no output.

- [ ] **Step 4: Delete the old component.**

```bash
git rm client/src/components/AuroraBackground.jsx client/src/components/AuroraBackground.css
```

- [ ] **Step 5: Build + lint.** Run: `npm run build && npm run lint`. Expected: both succeed (a leftover import would fail the build — this is the regression guard).

- [ ] **Step 6: Full manual verification matrix.** `npm run dev` and check each:
  - `/login` and `/register` — bold Refracted Ascent on the brand aside, form still readable.
  - 404 route — bold effect.
  - An in-app page (e.g. `/dashboard`) — quiet `app` effect, content fully readable.
  - Toggle light/dark on each — base color follows theme.
  - Enable `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS prefers-reduced-motion) — static gradient only, no canvas animation, no errors.
  - Disable WebGL (DevTools → run with WebGL off, or test on a context-loss) — static gradient fallback, no errors.
  - Open a modal over an in-app page — confirm it is NOT trapped behind the sidebar (z-index:-1 contract holds).

- [ ] **Step 7: Commit.**

```bash
git add client/src/components/AuthLayout.jsx client/src/components/Layout.jsx
git commit -m "feat(client): adopt RefractedAscent across auth/app, remove AuroraBackground"
```

---

## Self-Review

**Spec coverage:**
- Shader concept (beam/refraction/ascent/bloom/depth/motes) → Task 3. ✓
- Drop-in component + `variant` API → Tasks 1, 4. ✓
- z-index/pointer-events/aria layering contract → Task 1 (CSS) + component root. ✓
- Theme-aware via CSS vars + `data-theme` observer → Task 3. ✓
- Variants hero/app (intensity, fps, motes/parallax) → Task 4. ✓
- Static fallback for reduced-motion / no-WebGL → Tasks 1 (CSS+gate), 2 (link-fail + context-loss). ✓
- DPR cap, visibility pause, IntersectionObserver pause → Task 2. ✓
- Swap 3 usages, remove AuroraBackground → Tasks 1 (NotFound), 5 (AuthLayout, Layout, delete). ✓
- No new deps → Global Constraints; nothing touches package.json. ✓
- Verification matrix → Task 5 Step 6. ✓

**Placeholder scan:** No TBD/TODO; all code blocks are complete; the only deferred value (cool spectral color) is a concrete constant `vec3(0.18,0.43,0.45)` / `[0.18,0.43,0.45]`. ✓

**Type consistency:** `compile`/`buildProgram`/`readPalette`/`hexToRgb` signatures consistent across tasks; `U.*` uniform names match the GLSL `u_*` names; `VARIANTS` keys (`intensity`/`motes`/`parallax`/`fps`) match their uniform usage; the single `frame(now)` definition (Task 4 replaces Task 2's). ✓
