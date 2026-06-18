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
  // AI-authored resumes carry their own standalone HTML — render that verbatim.
  if (draft && typeof draft.generatedHtml === 'string' && draft.generatedHtml.trim()) {
    const { buffer } = await renderHtmlDoc(draft.generatedHtml);
    return buffer;
  }
  const design = resolveDesign(draft);
  const html = resumeHtml(design, draft);
  return (await renderHtmlDoc(html)).buffer;
}

// A4 at 96 CSS-dpi: 210mm × 297mm ≈ 794 × 1123 px. Used to estimate page count
// for the self-heal/overflow check (Stage C of the AI-authored pipeline).
const A4_PAGE_PX = 1123;

// Fill bands for the "always fill a full A4" guarantee. A SINGLE-page resume must
// fill at least FILL_MIN of the page (no half-empty page); a TWO-page resume must
// not leave a near-empty trailing page (its last page fills at least TRAILING_MIN,
// else we compress back toward one full page). Tunable.
const FILL_MIN = 0.85;
const TRAILING_MIN = 0.5;

/**
 * Render an arbitrary (UNTRUSTED, already-sanitized) HTML document to a PDF and,
 * in the same pass, measure it for the verify/repair loop. SECURITY: the page is
 * rendered OFFLINE — every non-document network request (external CSS/JS/img/font)
 * is aborted, so a malicious resume can neither exfiltrate nor SSRF. Returns
 * `{ buffer, pages, text, height, screenshot }` where `height` is the TRUE content
 * height in px (min-heights neutralized — see the measure block), `pages` is the A4
 * page-count estimate derived from it, `text` is the rendered innerText (CUIC field
 * checks), and `screenshot` is a PNG Buffer of the rendered page (only when
 * `opts.screenshot` is set — fed to the vision design critic).
 * @param {string} html
 * @param {{ measure?: boolean, screenshot?: boolean }} [opts]
 */
async function renderHtmlDoc(html, { measure = true, screenshot = false } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Block ALL sub-resource loads — only the inline document itself renders.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.url() === 'about:blank') return req.continue();
      // setContent uses a data/about:blank document, so any *other* request is a
      // sub-resource (external font/img/script/css) → abort it.
      if (req.resourceType() === 'document') return req.continue();
      return req.abort();
    });

    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });

    let pages = 1;
    let text = '';
    let height = 0;
    if (measure) {
      const info = await page.evaluate(() => {
        // Measure the TRUE content height. Two traps to avoid:
        //  1. Designs use min-height (the template's `.page{min-height:1040px}` or an AI
        //     design's `min-height:100vh`), which would make even a near-empty resume read
        //     as a full page and defeat the underfull check. Neutralize min-height just for
        //     the measurement, then restore so the PDF below keeps the design as authored.
        //  2. `documentElement.scrollHeight` is floored at the viewport height, so a sparse
        //     page reads as a full viewport. Measure the lowest element bottom instead.
        const ov = document.createElement('style');
        ov.textContent = '*{min-height:0!important}';
        (document.head || document.documentElement).appendChild(ov);
        let maxBottom = document.body ? document.body.getBoundingClientRect().bottom : 0;
        const all = document.body ? document.body.getElementsByTagName('*') : [];
        for (let i = 0; i < all.length; i += 1) {
          const b = all[i].getBoundingClientRect().bottom; // relative to the viewport top
          if (b > maxBottom) maxBottom = b;
        }
        const h = Math.ceil(maxBottom + (window.scrollY || 0));
        const t = (document.body ? document.body.innerText : '') || '';
        ov.remove();
        return { height: h, text: t };
      });
      height = info.height || 0;
      pages = Math.max(1, Math.ceil(height / A4_PAGE_PX));
      text = info.text;
    }

    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);

    // Optional PNG of the rendered page for the vision design critic. `fullPage`
    // captures the whole resume (1–2 A4 pages) so the model judges the real layout.
    let shot = null;
    if (screenshot) {
      const png = await page.screenshot({ type: 'png', fullPage: true });
      shot = Buffer.isBuffer(png) ? png : Buffer.from(png);
    }
    return { buffer, pages, text, height, screenshot: shot };
  } finally {
    await page.close();
  }
}

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

module.exports = {
  resumeHtml, renderResumePdf, renderHtmlDoc, getBrowser, closeBrowser, exportResumePdfArtifact,
  A4_PAGE_PX, FILL_MIN, TRAILING_MIN,
};
