/**
 * Resume webfont inliner — lets the AI design with the WHOLE open-source font universe
 * while the PDF still renders fully OFFLINE.
 *
 * The design model may name ANY font in its CSS (e.g. `font-family:'Fraunces'`). Before we
 * render, we scan the HTML for the families it actually used, fetch their woff2 from the
 * Fontsource jsDelivr mirror (a superset of Google Fonts, all OFL/Apache), cache them on
 * disk, and inject `@font-face` rules with the bytes **base64-inlined as `data:` URIs**.
 *
 * Why this is safe + offline: the fetch happens HERE in Node (a font-name → CDN request,
 * no student PII), and the result is embedded in the document. By the time Puppeteer
 * renders, the font is inline, so [`renderHtmlDoc`](./resumePdf.js)'s "block every network
 * request" rule is never tripped, and `sanitizeResumeHtml` keeps `data:` URIs (it only
 * strips `http(s)`/`//`/`@import`). Best-effort throughout: any font that 404s or times out
 * is skipped and the browser falls back to the next family in the stack.
 */
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'fonts');

// Generic CSS keywords + fonts Chromium already has (or that aren't on Fontsource). We
// never fetch these — they render from the system or are CSS keywords. Everything else a
// model names is treated as a fetchable webfont.
const SYSTEM_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
  'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
  'inherit', 'initial', 'unset', 'revert', 'revert-layer',
  'arial', 'helvetica', 'helvetica neue', 'times', 'times new roman', 'courier',
  'courier new', 'verdana', 'tahoma', 'trebuchet ms', 'segoe ui', 'calibri', 'cambria',
  'garamond', 'palatino', 'palatino linotype', 'book antiqua', 'arial black', 'impact',
  'lucida console', 'lucida sans unicode', 'geneva', 'monaco', 'consolas', 'gill sans',
  'franklin gothic medium', 'century gothic', 'candara', 'optima', 'sans', 'mono',
  '-apple-system', 'blinkmacsystemfont',
]);

// Weights we try per family (regular / semibold / bold) — enough for body + headings.
const WEIGHTS = [400, 600, 700];
const FETCH_TIMEOUT_MS = 5000;
const MAX_FAMILIES = 6; // bound render weight + latency per resume
const cdn = (slug, file) => `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/${file}`;

const slugify = (family) => String(family || '').trim().toLowerCase()
  .replace(/['"]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Safe display name for the @font-face (used inside quotes) — keep it matchable to the
// model's `font-family` reference but strip anything that could break out of the CSS string.
const safeName = (family) => String(family || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();

/** Distinct, fetchable family names referenced anywhere in the document's CSS. */
function extractFamilies(html) {
  const out = new Map(); // lowercased key → display name (first seen)
  const re = /font-family\s*:\s*([^;}{]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    for (let token of m[1].split(',')) {
      token = token.trim().replace(/^['"]|['"]$/g, '').trim();
      if (!token || /^var\(/i.test(token)) continue;
      const key = token.toLowerCase();
      if (SYSTEM_FAMILIES.has(key) || out.has(key)) continue;
      if (safeName(token)) out.set(key, token);
    }
  }
  return [...out.values()];
}

async function fetchWoff2(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 100 ? buf : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

// Disk cache: `<slug>-<weight>.woff2` for static weights, `<slug>-var.woff2` for a
// variable file. A null is cached as a 0-byte `<slug>-<weight>.miss` marker so a missing
// weight isn't re-fetched every render.
function readCache(file) {
  try { const b = fs.readFileSync(path.join(CACHE_DIR, file)); return b.byteLength > 100 ? b : null; } catch { return null; }
}
function writeCache(file, buf) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, file), buf); } catch { /* cache is best-effort */ }
}
const isMissed = (file) => { try { return fs.existsSync(path.join(CACHE_DIR, `${file}.miss`)); } catch { return false; } };
const markMissed = (file) => writeCache(`${file}.miss`, Buffer.alloc(0));

async function loadStatic(slug, weight) {
  const file = `${slug}-${weight}.woff2`;
  const hit = readCache(file);
  if (hit) return hit;
  if (isMissed(file)) return null;
  const buf = await fetchWoff2(cdn(slug, `latin-${weight}-normal.woff2`));
  if (buf) { writeCache(file, buf); return buf; }
  markMissed(file);
  return null;
}

async function loadVariable(slug) {
  const file = `${slug}-var.woff2`;
  const hit = readCache(file);
  if (hit) return hit;
  if (isMissed(file)) return null;
  const buf = await fetchWoff2(cdn(slug, 'latin-wght-normal.woff2'));
  if (buf) { writeCache(file, buf); return buf; }
  markMissed(file);
  return null;
}

const faceRule = (name, weight, buf) =>
  `@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};font-display:swap;`
  + `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');}`;

/** Build the @font-face CSS for one family (static weights, else a variable face). */
async function buildFaceCss(family) {
  const slug = slugify(family);
  const name = safeName(family);
  if (!slug || !name) return '';
  const faces = [];
  for (const w of WEIGHTS) {
    const buf = await loadStatic(slug, w);
    if (buf) faces.push(faceRule(name, w, buf));
  }
  if (faces.length) return faces.join('\n');
  const variable = await loadVariable(slug);
  if (variable) {
    return `@font-face{font-family:'${name}';font-style:normal;font-weight:100 900;font-display:swap;`
      + `src:url(data:font/woff2;base64,${variable.toString('base64')}) format('woff2');}`;
  }
  return '';
}

/**
 * Inline `@font-face` for every webfont the document references, so any font the model
 * picked renders offline. Returns the HTML unchanged if it uses only system fonts or all
 * fetches fail. Never throws.
 * @param {string} html  sanitized resume HTML
 * @returns {Promise<string>}
 */
async function inlineFontsForHtml(html) {
  if (!html || typeof html !== 'string') return html;
  const families = extractFamilies(html).slice(0, MAX_FAMILIES);
  if (!families.length) return html;

  const blocks = [];
  await Promise.all(families.map(async (fam) => {
    try { const css = await buildFaceCss(fam); if (css) blocks.push(css); } catch { /* skip this font */ }
  }));
  if (!blocks.length) return html;

  const style = `<style data-rb-fonts>\n${blocks.join('\n')}\n</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1${style}`);
  return style + html;
}

/** Warm the disk cache for a list of families (setup script). Returns count cached. */
async function prefetchFamilies(families = []) {
  let ok = 0;
  for (const fam of families) {
    try { if (await buildFaceCss(fam)) ok += 1; } catch { /* best-effort */ }
  }
  return ok;
}

module.exports = { inlineFontsForHtml, extractFamilies, prefetchFamilies, buildFaceCss, slugify, CACHE_DIR };
