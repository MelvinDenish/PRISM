import { useEffect, useRef } from 'react';
import './RefractedAscent.css';

/**
 * RefractedAscent — cinematic WebGL background expressing the PRISM motto
 * ("refract your potential into a placement"): a beam of potential refracts
 * into a gold→amber→cool spectrum that rises and converges on a luminous
 * bloom focal point.
 *
 * variant="hero" → auth / 404 (full effect, parallax, motes).
 * variant="app"  → in-app pages (quiet, throttled, no motes/parallax).
 *
 * Falls back to a static CSS gradient when WebGL is unavailable or the user
 * prefers reduced motion. Sits at z-index:-1, pointer-events:none.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
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
`;

const VARIANTS = {
  hero: { intensity: 1.0, motes: 1.0, parallax: 1.0, fps: 0 },   // fps 0 = display refresh
  app: { intensity: 0.55, motes: 0.0, parallax: 0.0, fps: 30 },
};

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
    cool: [0.18, 0.43, 0.45], // derived cool spectral end (palette is warm-only)
    potential: [1.0, 0.97, 0.9],
  };
}

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

    const program = buildProgram(gl, VERT, FRAG);
    if (!program) {
      root.classList.add('is-fallback');
      return;
    }

    // Full-screen quad (TRIANGLE_STRIP).
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');

    const U = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      mouse: gl.getUniformLocation(program, 'u_mouse'),
      scroll: gl.getUniformLocation(program, 'u_scroll'),
      intensity: gl.getUniformLocation(program, 'u_intensity'),
      motes: gl.getUniformLocation(program, 'u_motes'),
      parallax: gl.getUniformLocation(program, 'u_parallax'),
      bg: gl.getUniformLocation(program, 'u_bg'),
      gold: gl.getUniformLocation(program, 'u_gold'),
      amber: gl.getUniformLocation(program, 'u_amber'),
      cool: gl.getUniformLocation(program, 'u_cool'),
      potential: gl.getUniformLocation(program, 'u_potential'),
    };

    const cfg = VARIANTS[variant] || VARIANTS.app;

    let palette = readPalette();
    const themeObserver = new MutationObserver(() => { palette = readPalette(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Parallax input (hero only).
    const targetIn = { mx: 0, my: 0, scroll: 0 };
    const eased = { mx: 0, my: 0, scroll: 0 };
    let onMove, onScroll;
    if (cfg.parallax > 0) {
      onMove = (e) => {
        targetIn.mx = (e.clientX / window.innerWidth) * 2 - 1;
        targetIn.my = (e.clientY / window.innerHeight) * 2 - 1;
      };
      onScroll = () => {
        const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
        targetIn.scroll = Math.min(1, window.scrollY / max);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const DPR_CAP = 1.5;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    let raf = 0;
    let running = true;
    let visible = true;
    const start = performance.now();
    const minDelta = cfg.fps > 0 ? 1000 / cfg.fps : 0;
    let last = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!running || !visible) return;
      if (minDelta && now - last < minDelta) return;
      last = now;

      eased.mx += (targetIn.mx - eased.mx) * 0.05;
      eased.my += (targetIn.my - eased.my) * 0.05;
      eased.scroll += (targetIn.scroll - eased.scroll) * 0.05;

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
      themeObserver.disconnect();
      if (onMove) window.removeEventListener('pointermove', onMove);
      if (onScroll) window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
  }, [variant]);

  return (
    <div ref={rootRef} className={`refracted-ascent refracted-ascent--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="refracted-ascent__canvas" />
    </div>
  );
};

export default RefractedAscent;
