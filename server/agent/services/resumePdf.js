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
    // Modern Puppeteer returns a Uint8Array; coerce to a Node Buffer so
    // storage.saveFile and Artifact.sizeBytes behave as the rest of the app expects.
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

module.exports = { resumeHtml, renderResumePdf, getBrowser, closeBrowser };
