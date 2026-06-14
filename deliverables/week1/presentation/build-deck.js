/*
 * Builds the native PowerPoint for the PRISM Week 1 review.
 * Run:  NODE_PATH="$(npm root -g)" node build-deck.js
 * Output: PRISM_Week1_Review.pptx
 *
 * Theme: restrained, document-grade. Charcoal ink on warm off-white paper,
 * a single muted teal accent, charcoal title/closing for contrast.
 * Includes a full per-collection schema reference (all 18 schemas).
 * (Previous brand-dark generator preserved as build-deck.dark.bak.js.)
 */
const pptxgen = require('pptxgenjs');

// ── Palette ───────────────────────────────────────────────────────────────
const PAPER   = 'F6F5F1';
const CARD     = 'FFFFFF';
const INK       = '1B2327';
const INK_SOFT  = '46535B';
const MUTED     = '5A646B';
const LINE      = 'D8D5CC';
const ACCENT    = '0F6E63';
const ACCENT_SOFT = 'E4EFEC';
const SLATE     = '3C4A52';

const DARK        = '1C262B';
const ON_DARK     = 'ECEAE3';
const ON_DARK_MUT = '9BA4A9';
const ACCENT_DK   = '6FB9AC';

const HF = 'Georgia';
const BF = 'Calibri';
const MF = 'Consolas';

const W = 13.333, H = 7.5;
const MX = 0.7;

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'L. Melvin Denish';
pres.company = 'CSE Department';
pres.title = 'PRISM — Week 1 Review';

const softShadow = () => ({ type: 'outer', color: 'B9B6AD', blur: 7, offset: 2, angle: 90, opacity: 0.45 });

// ── Auto page numbering ─────────────────────────────────────────────────────
let pageNo = 0;
function baseSlide() { pageNo++; const s = pres.addSlide(); s.background = { color: PAPER }; return s; }
function darkSlide() { pageNo++; const s = pres.addSlide(); s.background = { color: DARK }; return s; }

function footer(s) {
  s.addText('PRISM  ·  Placement Resources & Interview Skill Manager', {
    x: MX, y: H - 0.46, w: 9, h: 0.3, fontFace: BF, fontSize: 9, color: MUTED, align: 'left', margin: 0,
  });
  s.addText(String(pageNo).padStart(2, '0'), {
    x: W - 1.3, y: H - 0.46, w: 0.6, h: 0.3, fontFace: MF, fontSize: 9, color: MUTED, align: 'right', margin: 0,
  });
}

function header(s, kicker, title) {
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: 0.66, w: 0.16, h: 0.16, fill: { color: ACCENT } });
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: MX + 0.3, y: 0.6, w: 11.5, h: 0.3, fontFace: MF, fontSize: 11.5, color: ACCENT, bold: true, charSpacing: 2, margin: 0, valign: 'middle',
    });
  }
  s.addText(title, {
    x: MX, y: 1.0, w: W - 2 * MX, h: 0.85, fontFace: HF, fontSize: 30, color: INK, bold: true, margin: 0,
  });
}

function card(s, x, y, w, h, accent) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: softShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.06, h, fill: { color: accent || ACCENT } });
}

const bullets = (items, opts = {}) => items.map((t) => ({
  text: t, options: {
    bullet: { code: '2022', indent: 16 }, color: opts.color || INK_SOFT, fontSize: opts.fontSize || 14,
    fontFace: BF, breakLine: true, paraSpaceAfter: opts.gap != null ? opts.gap : 8,
  },
}));

// ── Flow-diagram helpers (rounded nodes + arrowed connectors) ───────────────
// A flow node: rounded rectangle with a bold title and optional descriptor.
function fnode(s, x, y, w, h, title, sub, opt = {}) {
  const filled = !!opt.fill;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: opt.fill || CARD },
    line: { color: opt.line || opt.accent || ACCENT, width: opt.lw || 1.25 },
    shadow: opt.flat ? undefined : softShadow(),
  });
  const tc = opt.titleColor || (filled ? 'FFFFFF' : INK);
  const sc = opt.subColor || (filled ? ON_DARK_MUT : MUTED);
  if (sub) {
    s.addText(title, { x: x + 0.1, y: y + 0.13, w: w - 0.2, h: 0.42, fontFace: BF, fontSize: opt.tfs || 12.5, color: tc, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(sub, { x: x + 0.12, y: y + 0.52, w: w - 0.24, h: Math.max(0.12, h - 0.6), fontFace: BF, fontSize: opt.sfs || 9.5, color: sc, align: 'center', valign: 'top', margin: 0, lineSpacingMultiple: 0.96 });
  } else {
    s.addText(title, { x: x + 0.08, y, w: w - 0.16, h, fontFace: BF, fontSize: opt.tfs || 12.5, color: tc, bold: true, align: 'center', valign: 'middle', margin: 0 });
  }
}
// Horizontal connector arrow (left → right), optional small caption above it.
function hArrow(s, x, y, w, label, color) {
  s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: color || SLATE, width: 1.6, endArrowType: 'triangle' } });
  if (label) s.addText(label, { x: x - 0.18, y: y - 0.32, w: w + 0.36, h: 0.26, fontFace: MF, fontSize: 8, color: MUTED, align: 'center', valign: 'bottom', margin: 0 });
}
// Vertical connector arrow (top → bottom), optional caption to the right.
function vArrow(s, x, y, h, label, color) {
  s.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color: color || SLATE, width: 1.6, endArrowType: 'triangle' } });
  if (label) s.addText(label, { x: x + 0.08, y: y + h / 2 - 0.16, w: 1.6, h: 0.32, fontFace: MF, fontSize: 8, color: MUTED, align: 'left', valign: 'middle', margin: 0 });
}
// Small rounded chip (compact label tile).
function chip(s, x, y, w, h, title, sub, opt = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.07, fill: { color: opt.fill || ACCENT_SOFT }, line: { color: opt.line || ACCENT, width: 1 } });
  s.addText(title, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: 0.34, fontFace: BF, fontSize: opt.tfs || 12, color: opt.titleColor || ACCENT, bold: true, align: 'center', valign: 'middle', margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.12, y: y + 0.44, w: w - 0.24, h: h - 0.52, fontFace: BF, fontSize: opt.sfs || 9.5, color: opt.subColor || INK_SOFT, align: 'center', valign: 'top', margin: 0, lineSpacingMultiple: 0.95 });
}

// ════════════════════════════════════════════════════════════════════════
// 1 · TITLE
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = darkSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color: ACCENT } });
  s.addText('PRISM', { x: 1.1, y: 2.0, w: 11, h: 1.5, fontFace: HF, fontSize: 80, color: ON_DARK, bold: true, charSpacing: 1, margin: 0 });
  s.addText('Placement Resources & Interview Skill Manager', { x: 1.15, y: 3.55, w: 11, h: 0.6, fontFace: BF, fontSize: 22, color: ON_DARK_MUT, margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 1.15, y: 4.35, w: 3.55, h: 0.5, fill: { color: DARK }, line: { color: ACCENT_DK, width: 1 } });
  s.addText('WEEK 1   ·   INTERNSHIP REVIEW', { x: 1.15, y: 4.35, w: 3.55, h: 0.5, fontFace: MF, fontSize: 11, color: ACCENT_DK, bold: true, align: 'center', valign: 'middle', charSpacing: 1, margin: 0 });
  s.addText([
    { text: 'L. Melvin Denish', options: { bold: true, color: ON_DARK, fontSize: 14, breakLine: true } },
    { text: 'CSE  ·  3rd Year  ·  June 2026', options: { color: ON_DARK_MUT, fontSize: 12 } },
  ], { x: 1.15, y: 5.5, w: 8, h: 0.8, fontFace: BF, margin: 0 });
})();

// ════════════════════════════════════════════════════════════════════════
// 2 · AGENDA
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Overview', 'Agenda');
  const items = [
    ['01', 'What PRISM is — the big picture'],
    ['02', 'The problem & objectives'],
    ['03', 'Users & roles'],
    ['04', 'How it works — workflows & flowcharts'],
    ['05', 'Requirements & technology'],
    ['06', 'Database design + 18-schema reference'],
    ['07', 'Architecture & implementation'],
    ['08', 'Work done + what’s next (new features)'],
  ];
  const cols = 2, cw = 5.7, ch = 0.92, gx = 0.4, gy = 0.32, x0 = MX, y0 = 2.1;
  items.forEach(([num, label], i) => {
    const cx = x0 + (i % cols) * (cw + gx);
    const cy = y0 + Math.floor(i / cols) * (ch + gy);
    card(s, cx, cy, cw, ch);
    s.addText(num, { x: cx + 0.2, y: cy, w: 0.9, h: ch, fontFace: HF, fontSize: 24, color: ACCENT, bold: true, valign: 'middle', margin: 0 });
    s.addText(label, { x: cx + 1.15, y: cy, w: cw - 1.3, h: ch, fontFace: BF, fontSize: 14.5, color: INK, valign: 'middle', margin: 0 });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 3 · WHAT IS PRISM
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Understanding', 'What is PRISM?');
  s.addText('One platform for the entire campus-placement preparation journey.', {
    x: MX, y: 1.85, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 15, color: ACCENT, italic: true, margin: 0,
  });
  const feats = [
    ['Mentorship', '1:1 sessions with seniors'],
    ['Mock interviews', 'Live, mentor-hosted practice'],
    ['AI interview', 'LLM interviewer + evaluation'],
    ['Interview Game', '6-round placement simulation'],
    ['Résumé tools', 'Builder + ATS analysis'],
    ['Coding sandbox', '5 languages, test cases'],
    ['Resources', 'Mentor-verified library'],
    ['Analytics', 'Track real progress'],
  ];
  const cols = 4, cw = 2.85, ch = 1.5, gx = 0.27, gy = 0.3, x0 = MX, y0 = 2.45;
  feats.forEach(([t, d], i) => {
    const cx = x0 + (i % cols) * (cw + gx);
    const cy = y0 + Math.floor(i / cols) * (ch + gy);
    card(s, cx, cy, cw, ch);
    s.addText(t, { x: cx + 0.24, y: cy + 0.22, w: cw - 0.4, h: 0.5, fontFace: HF, fontSize: 15, color: INK, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.24, y: cy + 0.74, w: cw - 0.4, h: 0.6, fontFace: BF, fontSize: 12, color: MUTED, margin: 0 });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 3b · THE BIG PICTURE — what PRISM really is (value loop diagram)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Understanding', 'The Big Picture — One Measurable Loop');
  s.addText('PRISM turns scattered, unverified placement prep into a single loop where every attempt is scored — so a student can finally see whether they are improving.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.5, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0, lineSpacingMultiple: 1.0,
  });
  const stages = [
    ['Learn', 'Curated, mentor-verified resources'],
    ['Practise', 'Mock · AI interview · 6-round game · coding'],
    ['Get feedback', 'Mentor scorecards + AI evaluation'],
    ['Measure', 'Readiness across 5 skill pillars'],
    ['Improve', 'A focused daily plan — then repeat'],
  ];
  const nw = 2.05, nh = 1.55, gap = 0.42, y0 = 2.62, x0 = MX;
  stages.forEach(([t, d], i) => {
    const cx = x0 + i * (nw + gap);
    fnode(s, cx, y0, nw, nh, t, d, { accent: ACCENT, tfs: 15, sfs: 10.5 });
    if (i < stages.length - 1) hArrow(s, cx + nw + 0.02, y0 + nh / 2, gap - 0.04, null, ACCENT);
  });
  // loop-back arrow: from under the last stage to the first, pointing left
  const lx0 = x0 + nw / 2, lx1 = x0 + (stages.length - 1) * (nw + gap) + nw / 2;
  const lbY = y0 + nh + 0.5;
  s.addShape(pres.shapes.LINE, { x: lx0, y: y0 + nh, w: 0, h: 0.5, line: { color: SLATE, width: 1.4 } });
  s.addShape(pres.shapes.LINE, { x: lx1, y: y0 + nh, w: 0, h: 0.5, line: { color: SLATE, width: 1.4 } });
  s.addShape(pres.shapes.LINE, { x: lx0, y: lbY, w: lx1 - lx0, h: 0, line: { color: SLATE, width: 1.4, beginArrowType: 'triangle' } });
  s.addText('continuous loop — each pass raises readiness and reshapes the next daily plan', {
    x: lx0, y: lbY + 0.05, w: lx1 - lx0, h: 0.3, fontFace: MF, fontSize: 9.5, color: MUTED, align: 'center', margin: 0,
  });
  card(s, MX, 5.6, W - 2 * MX, 0.85);
  s.addText([
    { text: 'Two engines drive the loop:  ', options: { bold: true, color: ACCENT, fontSize: 14 } },
    { text: 'mentors (human depth, trust, real feedback) and always-on AI (practice + evaluation any time) — with analytics turning effort into a number.', options: { color: INK_SOFT, fontSize: 14 } },
  ], { x: MX + 0.3, y: 5.6, w: W - 2 * MX - 0.6, h: 0.85, fontFace: BF, valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 4 · THE PROBLEM
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Motivation', 'The Problem');
  const probs = [
    ['Fragmented', 'Scattered across WhatsApp groups, random PDFs, and a dozen separate sites.'],
    ['Unverified', 'No trusted, mentor-vetted source of resources or questions.'],
    ['Unmeasured', 'Neither student nor department can see if preparation is working.'],
  ];
  const cw = 3.85, ch = 2.5, gx = 0.45, x0 = MX, y0 = 2.2;
  probs.forEach(([t, d], i) => {
    const cx = x0 + i * (cw + gx);
    card(s, cx, y0, cw, ch, SLATE);
    s.addText('0' + (i + 1), { x: cx + 0.28, y: y0 + 0.25, w: 1.5, h: 0.7, fontFace: HF, fontSize: 30, color: SLATE, bold: true, margin: 0 });
    s.addText(t, { x: cx + 0.28, y: y0 + 1.02, w: cw - 0.55, h: 0.5, fontFace: HF, fontSize: 20, color: INK, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.28, y: y0 + 1.58, w: cw - 0.55, h: 0.85, fontFace: BF, fontSize: 13, color: MUTED, margin: 0 });
  });
  card(s, MX, 5.05, W - 2 * MX, 0.8);
  s.addText([
    { text: 'PRISM  ', options: { bold: true, color: ACCENT, fontSize: 16 } },
    { text: '= one role-based, auditable platform that fixes all three.', options: { color: INK, fontSize: 16 } },
  ], { x: MX + 0.3, y: 5.05, w: W - 2 * MX - 0.6, h: 0.8, fontFace: BF, align: 'left', valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 5 · OBJECTIVES
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Goals', 'Objectives');
  const left = [
    'Connect mentees with mentors (book → meet → feedback → rate)',
    'Enable 1:1 AND 1:many teaching',
    'Realistic practice without a human always present (AI)',
    'Help students build strong, ATS-ready résumés',
  ];
  const right = [
    'A trusted resource library + AI learning paths',
    'Make student progress visible and measurable',
    'Be safe & reliable enough for real, college-wide use',
  ];
  card(s, MX, 2.1, 5.85, 3.8, ACCENT);
  card(s, MX + 6.25, 2.1, 5.85, 3.8, SLATE);
  s.addText(bullets(left, { fontSize: 15, gap: 14 }), { x: MX + 0.32, y: 2.4, w: 5.3, h: 3.2, valign: 'top' });
  s.addText(bullets(right, { fontSize: 15, gap: 14 }), { x: MX + 6.57, y: 2.4, w: 5.3, h: 3.0, valign: 'top' });
  s.addText('← Week 1 engineering focus', { x: MX + 6.57, y: 5.3, w: 5.3, h: 0.4, fontFace: BF, fontSize: 12, italic: true, color: ACCENT, margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 6 · USERS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Understanding', 'Users — Three Roles');
  const roles = [
    ['Mentee', 'The student', ['Book mentorship sessions', 'Practise AI interviews & the Game', 'Build & analyze résumés', 'Study resources, track progress']],
    ['Mentor', 'Senior / placed / faculty', ['Publish availability', 'Teach 1:1 and group mocks', 'Upload trusted resources', 'Give structured feedback']],
    ['Admin', 'Placement coordinator', ['Manage users & content', 'Curate topics / companies', 'Moderate the platform', 'View platform-wide analytics']],
  ];
  const cw = 3.85, ch = 3.5, gx = 0.45, x0 = MX, y0 = 2.1;
  roles.forEach(([name, sub, items], i) => {
    const cx = x0 + i * (cw + gx);
    card(s, cx, y0, cw, ch);
    s.addText(name, { x: cx + 0.3, y: y0 + 0.26, w: cw - 0.55, h: 0.5, fontFace: HF, fontSize: 20, color: INK, bold: true, margin: 0 });
    s.addText(sub, { x: cx + 0.3, y: y0 + 0.78, w: cw - 0.55, h: 0.35, fontFace: MF, fontSize: 10.5, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
    s.addText(bullets(items, { fontSize: 13, gap: 9 }), { x: cx + 0.32, y: y0 + 1.2, w: cw - 0.6, h: 2.2, valign: 'top' });
  });
  s.addText('Roles are enforced on the SERVER, on every action.', { x: MX, y: 5.85, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: MUTED, align: 'center', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 7a · WORKFLOW — END-TO-END JOURNEY (overview diagram)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Proposed Workflow', 'How PRISM Works — End to End');
  s.addText('The same backbone for everyone: join, prepare one of three ways, get scored, and watch your readiness move.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  // top stage spine
  const stages = [
    ['1 · Join', 'Sign up · pick role · profile'],
    ['2 · Prepare', 'Choose a track  (below)'],
    ['3 · Get feedback', 'Scorecards · AI eval · server scoring'],
    ['4 · Measure & plan', 'Readiness (5 pillars) → daily plan'],
  ];
  const nw = 2.5, nh = 1.1, step = 3.1, y0 = 2.4, x0 = MX;
  stages.forEach(([t, d], i) => {
    const cx = x0 + i * step;
    fnode(s, cx, y0, nw, nh, t, d, { accent: i === 1 ? SLATE : ACCENT, tfs: 13.5, sfs: 10 });
    if (i < stages.length - 1) hArrow(s, cx + nw + 0.02, y0 + nh / 2, step - nw - 0.04, null, ACCENT);
  });
  // fan from "Prepare" to three track chips
  const prepCx = x0 + 1 * step + nw / 2;
  const chips = [
    ['Mentor 1:1', 'book → meet → rate'],
    ['Practice', 'mentor mocks · AI · game · coding'],
    ['Resources & paths', 'library → AI learning path'],
  ];
  const cw = 3.85, cgap = 0.19, cy = 4.2, ch = 1.15;
  const cxs = chips.map((_, i) => x0 + i * (cw + cgap));
  const centers = cxs.map((cx) => cx + cw / 2);
  const railY = 3.9;
  s.addShape(pres.shapes.LINE, { x: prepCx, y: y0 + nh, w: 0, h: railY - (y0 + nh), line: { color: SLATE, width: 1.4 } });
  s.addShape(pres.shapes.LINE, { x: centers[0], y: railY, w: centers[2] - centers[0], h: 0, line: { color: SLATE, width: 1.4 } });
  centers.forEach((c) => s.addShape(pres.shapes.LINE, { x: c, y: railY, w: 0, h: cy - railY, line: { color: SLATE, width: 1.4, endArrowType: 'triangle' } }));
  chips.forEach(([t, d], i) => chip(s, cxs[i], cy, cw, ch, t, d, { tfs: 13, sfs: 10 }));
  // caption band
  card(s, MX, 5.62, W - 2 * MX, 0.92);
  s.addText([
    { text: 'Step 2 runs three ways  ', options: { bold: true, color: ACCENT, fontSize: 13.5 } },
    { text: '— 1:1 mentorship, practice (mentor-led & solo), or resource learning paths (detailed next). Every track feeds Step 3, and Step 4’s daily plan sends you back to Step 2 ', options: { color: INK_SOFT, fontSize: 13.5 } },
    { text: 'a little stronger.', options: { bold: true, color: ACCENT, fontSize: 13.5 } },
  ], { x: MX + 0.3, y: 5.62, w: W - 2 * MX - 0.6, h: 0.92, fontFace: BF, valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 7 · WORKFLOW
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Workflow · Track 1 of 3', 'The 1:1 Mentorship Loop');
  const steps = [
    ['Set availability', 'Mentor'], ['Browse & book', 'Mentee'], ['Approve / reject', 'Mentor'],
    ['Join video call', 'Both'], ['Complete', 'System'], ['Rate each other', 'Both'],
  ];
  const bw = 1.78, bh = 1.55, gap = 0.26, x0 = MX, y0 = 2.7;
  steps.forEach(([t, who], i) => {
    const cx = x0 + i * (bw + gap);
    card(s, cx, y0, bw, bh);
    s.addText(String(i + 1), { x: cx + 0.18, y: y0 + 0.14, w: 0.6, h: 0.5, fontFace: HF, fontSize: 22, color: ACCENT, bold: true, margin: 0 });
    s.addText(t, { x: cx + 0.18, y: y0 + 0.66, w: bw - 0.34, h: 0.55, fontFace: BF, fontSize: 12.5, color: INK, bold: true, margin: 0 });
    s.addText(who, { x: cx + 0.18, y: y0 + 1.18, w: bw - 0.34, h: 0.3, fontFace: MF, fontSize: 9.5, color: MUTED, margin: 0 });
    if (i < steps.length - 1) {
      s.addText('›', { x: cx + bw - 0.02, y: y0, w: gap + 0.04, h: bh, fontFace: HF, fontSize: 20, color: SLATE, bold: true, align: 'center', valign: 'middle', margin: 0 });
    }
  });
  card(s, MX, 4.75, W - 2 * MX, 0.85);
  s.addText([
    { text: 'Atomic booking ', options: { bold: true, color: ACCENT, fontSize: 13 } },
    { text: '— no two mentees can grab the same slot. Plus solo AI practice anytime, with no mentor required.', options: { color: INK_SOFT, fontSize: 13 } },
  ], { x: MX + 0.3, y: 4.75, w: W - 2 * MX - 0.6, h: 0.85, fontFace: BF, valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 7c · WORKFLOW — TRACK 2: PRACTICE (mentor-led & solo)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Workflow · Track 2 of 3', 'Practice — Mentor-led & Solo');
  s.addText('Two ways to rehearse: with a mentor watching, or alone against the AI, any time.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  const flowRow = (y, lab, labSub, accent, nodes) => {
    chip(s, MX, y, 1.7, 1.0, lab, labSub, {
      fill: accent === ACCENT ? ACCENT_SOFT : 'EBEDEE', line: accent,
      titleColor: accent === ACCENT ? ACCENT : SLATE, subColor: MUTED, tfs: 12, sfs: 9,
    });
    const nx0 = MX + 1.7 + 0.35, nw = 2.05, ngap = 0.42, step = nw + ngap;
    hArrow(s, MX + 1.7 + 0.02, y + 0.5, 0.31, null, accent);
    nodes.forEach(([t, d], i) => {
      const cx = nx0 + i * step;
      fnode(s, cx, y, nw, 1.0, t, d, { accent, tfs: 12, sfs: 9 });
      if (i < nodes.length - 1) hArrow(s, cx + nw + 0.02, y + 0.5, ngap - 0.04, null, accent);
    });
  };
  flowRow(2.5, 'Mentor-led', '1 : many', ACCENT, [
    ['Create', 'mentor opens a mock / GD'],
    ['Join', 'mentees enter the room'],
    ['Run live', 'video + coding room'],
    ['Scorecard', 'per-mentee rubric'],
  ]);
  flowRow(4.25, 'Solo', 'no mentor', SLATE, [
    ['Pick mode', 'AI interview · game · coding'],
    ['Play', '6 rounds / Q&A / run code'],
    ['Auto-score', 'server grades · AI evals'],
    ['Feedback', 'result + skill signals'],
  ]);
  card(s, MX, 5.95, W - 2 * MX, 0.85);
  s.addText([
    { text: 'Server-authoritative scoring:  ', options: { bold: true, color: ACCENT, fontSize: 13.5 } },
    { text: 'solo rounds are graded by the server — the browser never receives the answer key, so a score can’t be forged.', options: { color: INK_SOFT, fontSize: 13.5 } },
  ], { x: MX + 0.3, y: 5.95, w: W - 2 * MX - 0.6, h: 0.85, fontFace: BF, valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 7d · WORKFLOW — TRACK 3: LEARN BY A PATH
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Workflow · Track 3 of 3', 'Learn by a Path');
  s.addText('From a trusted library to an AI-ordered study plan — with progress that actually counts.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  const nodes = [
    ['Upload', 'mentor adds a resource\n(topic · company · level)'],
    ['Library', 'trusted, filterable catalog'],
    ['AI path', 'LLM orders it into steps'],
    ['Study & tick', 'work through, mark done'],
    ['Progress', 'updates readiness'],
  ];
  const nw = 2.05, ngap = 0.42, step = nw + ngap, y0 = 2.65, nh = 1.5;
  nodes.forEach(([t, d], i) => {
    const cx = MX + i * step;
    fnode(s, cx, y0, nw, nh, t, d, { accent: i === 2 ? SLATE : ACCENT, tfs: 14, sfs: 9.5 });
    if (i < nodes.length - 1) hArrow(s, cx + nw + 0.02, y0 + nh / 2, ngap - 0.04, null, ACCENT);
  });
  const iw = 5.8, iy = 4.7, ih = 1.55;
  card(s, MX, iy, iw, ih, SLATE);
  s.addText('AI LEARNING PATH', { x: MX + 0.3, y: iy + 0.2, w: iw - 0.5, h: 0.3, fontFace: MF, fontSize: 11.5, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
  s.addText('The system feeds a topic’s resources to the LLM, which returns an ordered, step-by-step plan. Steps are embedded in one document, so the whole path loads and saves in a single read/write.', { x: MX + 0.3, y: iy + 0.58, w: iw - 0.55, h: ih - 0.7, fontFace: BF, fontSize: 12.5, color: INK_SOFT, valign: 'top', margin: 0, lineSpacingMultiple: 1.0 });
  const rx = MX + iw + 0.3;
  card(s, rx, iy, iw, ih, ACCENT);
  s.addText('WHY IT STAYS TRUSTED', { x: rx + 0.3, y: iy + 0.2, w: iw - 0.5, h: 0.3, fontFace: MF, fontSize: 11.5, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  s.addText('Only mentors and admins can publish resources. An ownership check gates edit and delete — so only the uploader (or an admin) can change a resource, and the library stays curated.', { x: rx + 0.3, y: iy + 0.58, w: iw - 0.55, h: ih - 0.7, fontFace: BF, fontSize: 12.5, color: INK_SOFT, valign: 'top', margin: 0, lineSpacingMultiple: 1.0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 7e · WORKFLOW — LIFECYCLE FLOWCHARTS (state machines)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Workflow · Lifecycles', 'Lifecycle Flowcharts');
  s.addText('The two most important objects are small state machines — every transition is enforced on the server.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  s.addShape(pres.shapes.LINE, { x: 6.6, y: 2.35, w: 0, h: 3.95, line: { color: LINE, width: 1 } });
  const bw = 2.0, bh = 0.5, step = 0.78;
  // ---- LEFT: Mentorship Session ----
  s.addText('MENTORSHIP SESSION', { x: MX, y: 2.3, w: 5.6, h: 0.3, fontFace: MF, fontSize: 12, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  const Lx = 1.35, Lc = Lx + bw / 2, ly0 = 2.6;
  const chain = ['pending', 'approved', 'in-progress', 'completed', 'rated'];
  chain.forEach((t, i) => fnode(s, Lx, ly0 + i * step, bw, bh, t, null, {
    accent: ACCENT, fill: i === 4 ? ACCENT : CARD, titleColor: i === 4 ? 'FFFFFF' : INK, tfs: 11.5,
  }));
  const vlabels = ['approve', 'start', 'end', 'rate'];
  for (let i = 0; i < 4; i++) vArrow(s, Lc, ly0 + i * step + bh, step - bh, vlabels[i], ACCENT);
  const Tx = 4.0;
  fnode(s, Tx, ly0, 1.9, bh, 'rejected', null, { accent: SLATE, fill: SLATE, titleColor: 'FFFFFF', tfs: 11 });
  hArrow(s, Lx + bw + 0.02, ly0 + bh / 2, Tx - (Lx + bw) - 0.04, 'reject', SLATE);
  fnode(s, Tx, ly0 + step, 1.9, bh, 'cancelled', null, { accent: SLATE, fill: SLATE, titleColor: 'FFFFFF', tfs: 11 });
  hArrow(s, Lx + bw + 0.02, ly0 + step + bh / 2, Tx - (Lx + bw) - 0.04, 'cancel', SLATE);
  // ---- RIGHT: Interview Game ----
  s.addText('INTERVIEW GAME', { x: 6.9, y: 2.3, w: 5.6, h: 0.3, fontFace: MF, fontSize: 12, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  const Gx = 7.6, gc = Gx + bw / 2;
  const gchain = ['in-progress', 'play a round', 'server scores it', 'completed'];
  gchain.forEach((t, i) => fnode(s, Gx, ly0 + i * step, bw, bh, t, null, {
    accent: ACCENT, fill: i === 3 ? ACCENT : CARD, titleColor: i === 3 ? 'FFFFFF' : INK, tfs: 11.5,
  }));
  const glabels = ['start', 'serve → submit', 'next (x6)'];
  for (let i = 0; i < 3; i++) vArrow(s, gc, ly0 + i * step + bh, step - bh, glabels[i], ACCENT);
  const failY = ly0 + 2 * step;
  fnode(s, 10.3, failY, 1.9, bh, 'failed', null, { accent: SLATE, fill: SLATE, titleColor: 'FFFFFF', tfs: 11 });
  hArrow(s, Gx + bw + 0.02, failY + bh / 2, 10.3 - (Gx + bw) - 0.04, 'fail', SLATE);
  s.addText('Only a mentor can approve a session  ·  only the server assigns a game score — the browser never gets the answer key.', {
    x: MX, y: 6.5, w: W - 2 * MX, h: 0.3, fontFace: BF, fontSize: 11.5, italic: true, color: MUTED, align: 'center', margin: 0,
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 8 · ACCESS MODEL
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Proposed Workflow', 'Access Model — Role AND Ownership');
  const head = (t, left) => ({ text: t, options: { fill: { color: ACCENT_SOFT }, color: ACCENT, bold: true, fontSize: 13, align: left ? 'left' : 'center', valign: 'middle' } });
  const cell = (t, c, left) => ({ text: t, options: { color: c || INK, bold: c === ACCENT, fontSize: 13, align: left ? 'left' : 'center', valign: 'middle' } });
  const Y = 'Yes', N = '—';
  const rows = [
    [head('Capability', true), head('Mentee'), head('Mentor'), head('Admin')],
    [cell('Browse resources', INK, true), cell(Y, ACCENT), cell(Y, ACCENT), cell(Y, ACCENT)],
    [cell('Edit / delete a resource', INK, true), cell(N, MUTED), cell('Own only', SLATE), cell('Any', ACCENT)],
    [cell('Book a session', INK, true), cell(Y, ACCENT), cell(N, MUTED), cell(N, MUTED)],
    [cell('Approve a session', INK, true), cell(N, MUTED), cell(Y, ACCENT), cell(N, MUTED)],
    [cell('Admin panel', INK, true), cell(N, MUTED), cell(N, MUTED), cell(Y, ACCENT)],
  ];
  s.addTable(rows, {
    x: MX, y: 2.15, w: W - 2 * MX, colW: [5.93, 2, 2, 2], rowH: 0.52,
    fill: { color: CARD }, color: INK, border: { type: 'solid', color: LINE, pt: 1 },
    align: 'center', valign: 'middle', fontFace: BF,
  });
  card(s, MX, 5.7, W - 2 * MX, 0.8);
  s.addText([
    { text: '“Own only” ', options: { bold: true, color: ACCENT, fontSize: 14 } },
    { text: '= an ownership check on the specific record, not just a role check — the key security idea (closes IDOR bugs).', options: { color: INK_SOFT, fontSize: 14 } },
  ], { x: MX + 0.3, y: 5.7, w: W - 2 * MX - 0.6, h: 0.8, fontFace: BF, align: 'left', valign: 'middle', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 9 · SYSTEM REQUIREMENTS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Specification', 'System Requirements');
  card(s, MX, 2.05, 5.85, 4.15, ACCENT);
  card(s, MX + 6.25, 2.05, 5.85, 4.15, SLATE);
  s.addText('FUNCTIONAL', { x: MX + 0.32, y: 2.28, w: 5, h: 0.4, fontFace: MF, fontSize: 14, color: ACCENT, bold: true, charSpacing: 2, margin: 0 });
  s.addText(bullets([
    'Authentication & profiles',
    'Mentorship: availability, booking, sessions, ratings',
    'Interview practice: AI, Game, coding, GD',
    'Résumé builder & ATS analysis',
    'Resource library & learning paths',
    'Progress, analytics, notifications, admin',
  ], { fontSize: 13, gap: 9 }), { x: MX + 0.32, y: 2.75, w: 5.3, h: 3.3, valign: 'top' });
  s.addText('NON-FUNCTIONAL  ·  PRODUCTION-GRADE', { x: MX + 6.57, y: 2.28, w: 5.3, h: 0.4, fontFace: MF, fontSize: 14, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Auth + role/ownership on every endpoint',
    'No score forgery · sandboxed code · authed realtime',
    'Fail-fast config · structured errors · request tracing',
    'Indexed queries · pagination · atomic writes',
    'Rate limiting · secrets never leaked',
    'Self-hostable & student-maintainable',
  ], { fontSize: 13, gap: 9 }), { x: MX + 6.57, y: 2.75, w: 5.3, h: 3.3, valign: 'top' });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 10 · TECH STACK
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Specification', 'Technology Stack');
  const rows = [
    ['Client', 'React 19 · Vite 7 · React Router 7 · Socket.IO-client · PeerJS · Monaco · Recharts'],
    ['Server', 'Node.js · Express 4 · Socket.IO 4 · Mongoose 8 · JWT · bcrypt'],
    ['Database', 'MongoDB (document database)'],
    ['AI', 'Groq (Llama 3.1) · Google Gemini'],
    ['Code execution', 'Judge0 (sandboxed)'],
    ['Realtime video', 'WebRTC via PeerJS'],
    ['Infra', 'Docker (MongoDB) · nginx · PM2 · Redis (planned)'],
  ];
  const rh = 0.62, x0 = MX, y0 = 2.05, lw = 2.7, rw = W - 2 * MX - lw - 0.08;
  rows.forEach(([k, v], i) => {
    const cy = y0 + i * (rh + 0.06);
    s.addShape(pres.shapes.RECTANGLE, { x: x0, y: cy, w: lw, h: rh, fill: { color: ACCENT } });
    s.addText(k, { x: x0 + 0.18, y: cy, w: lw - 0.3, h: rh, fontFace: BF, fontSize: 14, color: 'FFFFFF', bold: true, valign: 'middle', margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + lw + 0.08, y: cy, w: rw, h: rh, fill: { color: CARD }, line: { color: LINE, width: 1 } });
    s.addText(v, { x: x0 + lw + 0.3, y: cy, w: rw - 0.45, h: rh, fontFace: BF, fontSize: 12.5, color: INK_SOFT, valign: 'middle', margin: 0 });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 11 · DATABASE DESIGN (overview)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Design', 'Database Design');
  card(s, MX, 2.05, 6.0, 4.15, ACCENT);
  s.addText('PRINCIPLES', { x: MX + 0.32, y: 2.28, w: 5, h: 0.4, fontFace: MF, fontSize: 14, color: ACCENT, bold: true, charSpacing: 2, margin: 0 });
  s.addText(bullets([
    'MongoDB (document DB) via Mongoose schemas',
    'Embed data owned by its parent (rounds, slots, résumé sections)',
    'Reference shared entities (User, Topic, Company, Resource)',
    'Index only fields real queries touch → O(log n), not O(n)',
    'TTL index auto-purges old notifications',
    'Atomic single-document writes guard integrity',
  ], { fontSize: 13, gap: 10 }), { x: MX + 0.32, y: 2.75, w: 5.5, h: 3.4, valign: 'top' });
  const rx = MX + 6.45, rw = 5.65;
  card(s, rx, 2.05, rw, 4.15, SLATE);
  s.addText('18 COLLECTIONS  ·  CENTERED ON USER', { x: rx + 0.32, y: 2.28, w: rw - 0.5, h: 0.4, fontFace: MF, fontSize: 12.5, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: rx + rw / 2 - 0.7, y: 3.9, w: 1.4, h: 0.7, fill: { color: ACCENT }, shadow: softShadow() });
  s.addText('User', { x: rx + rw / 2 - 0.7, y: 3.9, w: 1.4, h: 0.7, fontFace: HF, fontSize: 15, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', margin: 0 });
  const nodes = ['Mentorship', 'InterviewGame', 'Resource', 'Progress', 'ResumeDraft', 'Notification'];
  const positions = [[rx + 0.32, 3.0], [rx + rw - 1.87, 3.0], [rx + 0.32, 4.05], [rx + rw - 1.87, 4.05], [rx + 0.32, 5.1], [rx + rw - 1.87, 5.1]];
  nodes.forEach((n, i) => {
    const [nx, ny] = positions[i];
    s.addShape(pres.shapes.RECTANGLE, { x: nx, y: ny, w: 1.55, h: 0.5, fill: { color: CARD }, line: { color: LINE, width: 1 } });
    s.addText(n, { x: nx, y: ny, w: 1.55, h: 0.5, fontFace: MF, fontSize: 10, color: INK, align: 'center', valign: 'middle', margin: 0 });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 11b · DATA MODEL — entity-relationship diagram (hub & spoke)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Design', 'Data Model — How Collections Relate');
  s.addText('User is the hub — almost every collection references it (the lines). A few objects instead embed their children in one document: InterviewGame (rounds), ResumeDraft (sections), LearningPath (steps) — shown with a heavier outline.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.5, fontFace: BF, fontSize: 13.5, color: ACCENT, italic: true, margin: 0, lineSpacingMultiple: 1.0,
  });
  // undirected diagonal/orthogonal connector (positive dims + flipV for the "/" diagonal)
  const connect = (x1, y1, x2, y2, color) => {
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    const sameSign = (x1 <= x2) === (y1 <= y2);
    s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: color || 'C2BFB6', width: 1 }, flipV: !sameSign });
  };
  const uX = 5.45, uY = 3.95, uW = 2.45, uH = 0.95;
  const uLeft = uX, uRight = uX + uW, uMidY = uY + uH / 2;
  const sw = 2.25, sh = 0.62;
  const left = [
    ['Availability', '→ User', 2.6, ACCENT],
    ['MentorshipSession', '→ User ×2', 3.42, ACCENT],
    ['MockInterview', '→ User', 4.24, ACCENT],
    ['MockFeedback', '→ User', 5.06, ACCENT],
  ];
  const right = [
    ['InterviewGame', 'embeds rounds', 2.6, SLATE],
    ['ResumeDraft', 'embeds sections', 3.42, SLATE],
    ['Progress', '→ User', 4.24, ACCENT],
    ['Notification', '→ User', 5.06, ACCENT],
  ];
  const lX = 0.9, rX = W - MX - sw;
  left.forEach(([t, d, y, c]) => connect(lX + sw, y + sh / 2, uLeft, uMidY));
  right.forEach(([t, d, y, c]) => connect(rX, y + sh / 2, uRight, uMidY));
  // central hub
  s.addShape(pres.shapes.OVAL, { x: uX, y: uY, w: uW, h: uH, fill: { color: ACCENT }, shadow: softShadow() });
  s.addText('User', { x: uX, y: uY, w: uW, h: uH, fontFace: HF, fontSize: 20, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', margin: 0 });
  // satellites (drawn after lines so they sit on top)
  left.forEach(([t, d, y, c]) => fnode(s, lX, y, sw, sh, t, null, { accent: c, line: c, lw: c === SLATE ? 2 : 1.25, tfs: 12.5 }));
  right.forEach(([t, d, y, c]) => fnode(s, rX, y, sw, sh, t, null, { accent: c, line: c, lw: c === SLATE ? 2 : 1.25, tfs: 12.5 }));
  // shared tags + caption
  chip(s, MX, 6.25, 1.55, 0.46, 'Topic', null, { tfs: 12 });
  chip(s, MX + 1.7, 6.25, 1.55, 0.46, 'Company', null, { tfs: 12 });
  s.addText('— two shared tags, Topic and Company: resources, sessions and the Interview Game can be focused by both; learning paths and progress are organised by Topic.', {
    x: MX + 3.45, y: 6.25, w: W - MX - (MX + 3.45), h: 0.46, fontFace: BF, fontSize: 12, color: INK_SOFT, valign: 'middle', margin: 0,
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 12 · SCHEMA INDEX (divider)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Database · Reference', 'Schema Reference — All 18 Collections');
  s.addText('Every collection follows, one per slide, with its complete fields and what it is used for.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13.5, italic: true, color: ACCENT, margin: 0,
  });
  const groups = [
    ['Identity', ['01  User']],
    ['Mentorship', ['02  MentorshipSession', '03  Availability']],
    ['1:many Teaching', ['04  MockInterview', '05  MockFeedback', '06  GDRoom']],
    ['Solo Practice', ['07  InterviewGame  (+ round)', '08  QuestionBank', '09  CodingQuestion', '10  CodeSubmission']],
    ['Résumé', ['11  ResumeDraft', '12  ResumeAnalysis']],
    ['Content & Learning', ['13  Topic', '14  Company', '15  Resource', '16  LearningPath  (+ step)']],
    ['Progress & Alerts', ['17  Progress', '18  Notification']],
  ];
  const colX = [MX, MX + 6.1];
  const split = [groups.slice(0, 4), groups.slice(4)];
  split.forEach((grp, ci) => {
    let yy = 2.35;
    grp.forEach(([label, names]) => {
      s.addText(label.toUpperCase(), { x: colX[ci], y: yy, w: 5.6, h: 0.3, fontFace: MF, fontSize: 11, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
      yy += 0.3;
      names.forEach((n) => {
        s.addText(n, { x: colX[ci] + 0.1, y: yy, w: 5.5, h: 0.26, fontFace: MF, fontSize: 12, color: INK, margin: 0 });
        yy += 0.27;
      });
      yy += 0.1;
    });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// 13–30 · ONE SCHEMA PER SLIDE
// ════════════════════════════════════════════════════════════════════════
function renderFields(s, fields, x, y, w, h, fs, cols) {
  const mk = (arr) => arr.flatMap(([f, t]) => ([
    { text: f, options: { fontFace: MF, fontSize: fs, color: INK, bold: true } },
    { text: '  ' + t, options: { fontFace: MF, fontSize: fs, color: MUTED, breakLine: true, paraSpaceAfter: 2 } },
  ]));
  if (cols === 2) {
    const half = Math.ceil(fields.length / 2);
    s.addText(mk(fields.slice(0, half)), { x, y, w: w / 2 - 0.12, h, valign: 'top', margin: 0, lineSpacingMultiple: 1.0 });
    s.addText(mk(fields.slice(half)), { x: x + w / 2 + 0.12, y, w: w / 2 - 0.12, h, valign: 'top', margin: 0, lineSpacingMultiple: 1.0 });
  } else {
    s.addText(mk(fields), { x, y, w, h, valign: 'top', margin: 0, lineSpacingMultiple: 1.0 });
  }
}

function schemaSlide(def) {
  const s = baseSlide();
  header(s, 'Database · Schema ' + def.n + ' / 18', def.name);
  s.addText(def.purpose, { x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: ACCENT, margin: 0 });
  const top = 2.4, ch = 6.45 - top;
  const lw = def.embedded ? 6.0 : 7.2;
  card(s, MX, top, lw, ch, ACCENT);
  s.addText('FIELDS', { x: MX + 0.3, y: top + 0.18, w: 3, h: 0.3, fontFace: MF, fontSize: 11, color: ACCENT, bold: true, charSpacing: 2, margin: 0 });
  renderFields(s, def.fields, MX + 0.32, top + 0.58, lw - 0.62, ch - 0.78, def.fs || 11, def.cols || 1);

  const rx = MX + lw + 0.3, rw = W - MX - rx;
  card(s, rx, top, rw, ch, SLATE);
  if (def.embedded) {
    s.addText('EMBEDDED · ' + def.embedded.name, { x: rx + 0.3, y: top + 0.18, w: rw - 0.6, h: 0.3, fontFace: MF, fontSize: 10.5, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
    renderFields(s, def.embedded.fields, rx + 0.32, top + 0.58, rw - 0.62, ch - 0.78, def.embedded.fs || 10, 1);
  } else {
    let yy = top + 0.18;
    s.addText('USED FOR', { x: rx + 0.3, y: yy, w: rw - 0.6, h: 0.3, fontFace: MF, fontSize: 10.5, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
    yy += 0.38;
    s.addText(def.about, { x: rx + 0.3, y: yy, w: rw - 0.6, h: 1.4, fontFace: BF, fontSize: 12, color: INK_SOFT, margin: 0, valign: 'top', lineSpacingMultiple: 1.05 });
    yy += 1.45;
    if (def.relations) {
      s.addText('RELATIONSHIPS', { x: rx + 0.3, y: yy, w: rw - 0.6, h: 0.3, fontFace: MF, fontSize: 10, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
      yy += 0.32;
      s.addText(def.relations, { x: rx + 0.3, y: yy, w: rw - 0.6, h: 0.8, fontFace: MF, fontSize: 9.5, color: INK_SOFT, margin: 0, valign: 'top', lineSpacingMultiple: 1.0 });
      yy += 0.85;
    }
    if (def.indexes) {
      s.addText('INDEXES', { x: rx + 0.3, y: yy, w: rw - 0.6, h: 0.3, fontFace: MF, fontSize: 10, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
      yy += 0.3;
      s.addText(def.indexes, { x: rx + 0.3, y: yy, w: rw - 0.6, h: 0.9, fontFace: MF, fontSize: 9.5, color: MUTED, margin: 0, valign: 'top', lineSpacingMultiple: 1.0 });
    }
  }
  footer(s);
}

const SCHEMAS = [
  {
    n: 1, name: 'User', fs: 10.5, cols: 2,
    purpose: 'Every account — mentor, mentee, or admin. The hub every other record points back to.',
    fields: [
      ['name', 'String, required'], ['email', 'String, required, unique'], ['password', 'String, required (bcrypt hash)'],
      ['role', 'enum mentor|mentee|admin, req'], ['bio', 'String'], ['skills', '[String]'], ['expertise', '[String]'],
      ['aimingCompany', 'String'], ['currentCompany', 'String'], ['experienceLevel', 'String'], ['experience', 'Number =0'],
      ['college', 'String'], ['graduationYear', 'Number'], ['linkedin', 'String'], ['github', 'String'],
      ['isOnline', 'Boolean =false'], ['profilePicture', 'String'], ['resumeUrl', 'String'], ['rating', 'Number =0'],
      ['totalReviews', 'Number =0'], ['failedLoginAttempts', 'Number =0'], ['lockUntil', 'Date'],
      ['passwordChangedAt', 'Date'], ['resetPasswordToken', 'String (hashed)'], ['resetPasswordExpire', 'Date'],
      ['createdAt', 'Date =now'],
    ],
    about: 'Stores identity, profile, mentor ratings, and the auth-security state: brute-force lockout, password-reset token (stored hashed), and a passwordChangedAt stamp used to invalidate old JWTs.',
    relations: 'Referenced by nearly every collection\n(mentor / mentee / user / uploadedBy ...)',
    indexes: 'email (unique) · role · resetPasswordToken',
  },
  {
    n: 2, name: 'MentorshipSession', fs: 11,
    purpose: 'One booked 1:1 session between a mentee and a mentor — its whole lifecycle from request to rating.',
    fields: [
      ['mentor', 'ObjectId → User, req'], ['mentee', 'ObjectId → User, req'], ['aimingCompany', 'ObjectId → Company'],
      ['agenda', 'String'], ['scheduledDate', 'Date, req'], ['duration', 'Number (minutes)'], ['meetingLink', 'String'],
      ['status', 'enum pending|approved|in-progress|\n        rejected|completed|cancelled'],
      ['mentorFeedback', 'String'], ['menteeFeedback', 'String'], ['ratingGiven', 'Number'], ['createdAt', 'Date =now'],
    ],
    about: 'Drives the booking → approve → meet → rate loop. A mentee rating updates the mentor\'s average; ratingGiven guards against rating twice.',
    relations: 'mentor, mentee → User\naimingCompany → Company',
    indexes: '{mentor, status} · {mentee, status}\n{scheduledDate: -1}',
  },
  {
    n: 3, name: 'Availability', fs: 11,
    purpose: 'A mentor\'s bookable calendar: recurring weekly slots plus concrete dated slots a mentee can claim.',
    fields: [
      ['mentor', 'ObjectId → User, req'],
      ['weeklySlots', '[{ day enum(Mon–Sun),\n   startTime, endTime,\n   isAvailable =true }]'],
      ['availableSlots', '[{ date, startTime, endTime,\n   isBooked =false,\n   bookedBy → User }]'],
      ['timezone', "String ='Asia/Kolkata'"],
    ],
    about: 'Booking flips availableSlots[i].isBooked via a single atomic conditional update, so two mentees can never claim the same slot under a race.',
    relations: 'mentor → User\navailableSlots.bookedBy → User',
    indexes: '(none — always loaded by mentor)',
  },
  {
    n: 4, name: 'MockInterview', fs: 11,
    purpose: 'A mentor-hosted group practice session (technical / HR / GD) with many participants.',
    fields: [
      ['type', 'enum technical|hr|gd, req'], ['mentor', 'ObjectId → User'], ['participants', '[ObjectId → User]'],
      ['companyFocus', 'ObjectId → Company'], ['topic', 'ObjectId → Topic'], ['scheduledDate', 'Date'],
      ['duration', 'Number'], ['meetingLink', 'String'],
      ['status', 'enum scheduled|ongoing|\n        completed|cancelled'], ['createdAt', 'Date =now'],
    ],
    about: 'The 1:many teaching format — one mentor running a practice round for several mentees, who each receive a MockFeedback scorecard.',
    relations: 'mentor, participants → User\ncompanyFocus → Company · topic → Topic',
    indexes: '{status, scheduledDate: -1} · {mentor}',
  },
  {
    n: 5, name: 'MockFeedback', fs: 11,
    purpose: 'A mentor\'s structured scorecard for one mentee in a mock interview.',
    fields: [
      ['mockInterview', 'ObjectId → MockInterview'], ['user', 'ObjectId → User'],
      ['communicationScore', 'Number'], ['technicalScore', 'Number'], ['confidenceScore', 'Number'],
      ['problemSolvingScore', 'Number'], ['overallScore', 'Number'],
      ['strengths', 'String'], ['weaknesses', 'String'], ['suggestions', 'String'], ['createdAt', 'Date =now'],
    ],
    about: 'Turns a practice session into measurable, repeatable feedback (the rubric scores) plus qualitative notes that feed a mentee\'s progress record.',
    relations: 'mockInterview → MockInterview\nuser → User',
    indexes: '(none)',
  },
  {
    n: 6, name: 'GDRoom', fs: 11,
    purpose: 'A live group-discussion room (up to 6) for multi-user GD practice.',
    fields: [
      ['participants', '[ObjectId → User]'], ['maxParticipants', 'Number =6'],
      ['status', 'enum waiting|active|completed'], ['gdTopic', 'String'], ['createdAt', 'Date =now'],
    ],
    about: 'Backs the real-time Group Discussion feature; participants join over WebRTC and the room tracks who is present and the discussion prompt.',
    relations: 'participants → User',
    indexes: '(none)',
  },
  {
    n: 7, name: 'InterviewGame', fs: 11,
    purpose: 'A solo 6-round placement simulation, scored on the server. Each round is embedded.',
    fields: [
      ['user', 'ObjectId → User, req'], ['rounds', '[roundSchema]  →'], ['currentRound', 'Number =0'],
      ['totalScore', 'Number =0'], ['maxTotalScore', 'Number =600'],
      ['status', 'enum in-progress|\n        completed|abandoned'],
      ['difficulty', 'enum easy|medium|hard'], ['companyFocus', 'ObjectId → Company'],
      ['startedAt', 'Date =now'], ['completedAt', 'Date'],
    ],
    embedded: {
      name: 'roundSchema', fs: 9.5,
      fields: [
        ['type', 'enum aptitude|technical1|\n   coding|gd|technical2|hr'],
        ['score', 'Number =0'], ['maxScore', 'Number =100'],
        ['answers', '[{ questionId, selectedAnswer,\n   isCorrect, timeTaken }]'],
        ['servedQuestions', '[{ questionId, ans }]\n   answer key — never sent to client'],
        ['status', 'enum pending|in-progress|\n   completed|skipped'],
        ['feedback', 'String'], ['completedAt', 'Date'],
      ],
    },
  },
  {
    n: 8, name: 'QuestionBank', fs: 9.5,
    purpose: 'The curated question pool — one model holding MCQ, HR, and coding questions; mentor-verified.',
    fields: [
      ['type', 'enum aptitude|technical|hr|coding, req'], ['category', "String (e.g. 'dsa', 'dbms')"],
      ['difficulty', 'enum easy|medium|hard =medium'],
      ['q', 'String (MCQ / HR prompt)'], ['opts', '[String]'], ['ans', 'String'], ['explanation', 'String'],
      ['title', 'String (coding)'], ['description', 'String (coding)'],
      ['examples', '[{ input, output, explanation }]'], ['testCases', '[{ input, expectedOutput }]'],
      ['boilerplate', '{ javascript, python, cpp, java, c }'], ['verified', 'Boolean =true'], ['createdAt', 'Date =now'],
    ],
    about: 'One flexible model serves all question shapes: MCQs reuse q / opts / ans; HR reuses q; coding uses title / testCases / boilerplate. The verified flag marks mentor-approved items.',
    relations: '(self-contained — no refs)',
    indexes: '{type, difficulty}  — for sampling rounds',
  },
  {
    n: 9, name: 'CodingQuestion', fs: 11,
    purpose: 'A standalone coding problem, tagged by topic and target company.',
    fields: [
      ['title', 'String, req'], ['description', 'String, req'], ['difficulty', 'enum easy|medium|hard'],
      ['topic', 'ObjectId → Topic'], ['companyTags', '[ObjectId → Company]'],
      ['sampleInput', 'String'], ['sampleOutput', 'String'], ['createdAt', 'Date =now'],
    ],
    about: 'Used by the coding practice library and mock interviews. (Its coding shape overlaps QuestionBank — consolidating the two is a planned cleanup.)',
    relations: 'topic → Topic\ncompanyTags → Company',
    indexes: '(none)',
  },
  {
    n: 10, name: 'CodeSubmission', fs: 11,
    purpose: 'A recorded code run inside a mock interview — the code, its output, and a score.',
    fields: [
      ['mockInterview', 'ObjectId → MockInterview'], ['question', 'ObjectId → CodingQuestion'],
      ['user', 'ObjectId → User'], ['code', 'String'], ['language', 'String'],
      ['output', 'String'], ['error', 'String'], ['score', 'Number'], ['submittedAt', 'Date =now'],
    ],
    about: 'Persists what a candidate ran during a coding round (executed in the Judge0 sandbox) so it can be reviewed and scored afterwards.',
    relations: 'mockInterview → MockInterview\nquestion → CodingQuestion · user → User',
    indexes: '(none)',
  },
  {
    n: 11, name: 'ResumeDraft', fs: 9.5,
    purpose: 'A full structured résumé a student builds — every section embedded in one document.',
    fields: [
      ['user', 'ObjectId → User, req'], ['name', "String ='Untitled Resume'"],
      ['template', 'enum modern|classic|creative'],
      ['personalInfo', '{ fullName, email, phone, location,\n   linkedin, github, portfolio, summary }'],
      ['education', '[{ institution, degree, field,\n   startDate, endDate, gpa }]'],
      ['experience', '[{ company, position, startDate,\n   endDate, current, description }]'],
      ['skills', '[String]'],
      ['projects', '[{ name, description,\n   technologies, link }]'],
      ['certifications', '[{ name, issuer, date }]'],
      ['coverLetter', '{ template, content,\n   jobTitle, companyName }'],
      ['jobDescription', 'String'], ['lastGenerated', 'Date'],
      ['createdAt', 'Date =now'], ['updatedAt', 'Date (pre-save hook)'],
    ],
    about: 'The whole résumé lives in one document (embedded sections) so it loads and saves in a single read/write. AI fills in content; export to DOCX/PDF on the client.',
    relations: 'user → User',
    indexes: '(none)',
  },
  {
    n: 12, name: 'ResumeAnalysis', fs: 11,
    purpose: 'The AI ATS report scoring a résumé against a specific job description.',
    fields: [
      ['user', 'ObjectId → User'], ['resumeUrl', 'String'], ['jobDescription', 'String'],
      ['matchScore', 'Number'], ['missingKeywords', '[String]'], ['suggestions', 'String'],
      ['redFlags', '[String]'], ['starSuggestions', '[String]'], ['createdAt', 'Date =now'],
    ],
    about: 'Stores the result of comparing an uploaded résumé to a JD: a match score, missing keywords, red flags, and STAR-format improvement suggestions.',
    relations: 'user → User',
    indexes: '(none)',
  },
  {
    n: 13, name: 'Topic', fs: 11,
    purpose: 'A subject tag (e.g. DSA, DBMS, OS) used to organise resources and questions.',
    fields: [
      ['name', 'String, required'], ['description', 'String'],
      ['createdBy', 'ObjectId → User'], ['createdAt', 'Date =now'],
    ],
    about: 'One of the two tagging dimensions across the platform. Resources, coding questions, learning paths and progress are all keyed by topic.',
    relations: 'createdBy → User\nreferenced by Resource, CodingQuestion, ...',
    indexes: '(none)',
  },
  {
    n: 14, name: 'Company', fs: 11,
    purpose: 'A target company with its interview pattern; used to focus preparation.',
    fields: [
      ['name', 'String, required, unique'], ['description', 'String'],
      ['interviewPattern', 'String'], ['difficultyLevel', 'String'], ['createdAt', 'Date =now'],
    ],
    about: 'The second tagging dimension. Sessions, mock interviews, the Interview Game and resources can all be "focused" on a company.',
    relations: 'referenced by MentorshipSession,\nMockInterview, InterviewGame, Resource ...',
    indexes: 'name (unique)',
  },
  {
    n: 15, name: 'Resource', fs: 11,
    purpose: 'A piece of mentor-uploaded study material, tagged by topic, company and level.',
    fields: [
      ['title', 'String, req'], ['description', 'String'], ['topic', 'ObjectId → Topic, req'],
      ['level', 'enum beginner|intermediate|advanced'], ['resourceType', 'enum video|article|pdf|link'],
      ['link', 'String'], ['fileUrl', 'String'], ['uploadedBy', 'ObjectId → User, req'],
      ['companyTag', 'ObjectId → Company'], ['createdAt', 'Date =now'],
    ],
    about: 'The trusted, curated library. uploadedBy is the ownership field the access checks use so only the uploader (or an admin) can edit or delete it.',
    relations: 'topic → Topic · companyTag → Company\nuploadedBy → User',
    indexes: '{topic, level} · {uploadedBy} · {createdAt: -1}',
  },
  {
    n: 16, name: 'LearningPath', fs: 11,
    purpose: 'An ordered study path through a topic\'s resources; AI can generate it. Steps embedded.',
    fields: [
      ['user', 'ObjectId → User, req'], ['topic', 'ObjectId → Topic, req'], ['title', 'String'],
      ['description', 'String'], ['level', 'enum beginner|\n        intermediate|advanced'],
      ['steps', '[stepSchema]  →'], ['totalSteps', 'Number =0'], ['completedSteps', 'Number =0'],
      ['progress', 'Number =0'], ['aiGenerated', 'Boolean =false'], ['createdAt', 'Date =now'],
    ],
    embedded: {
      name: 'stepSchema', fs: 10,
      fields: [
        ['order', 'Number'], ['title', 'String'], ['description', 'String'],
        ['resource', 'ObjectId → Resource'], ['resourceTitle', 'String'], ['resourceLink', 'String'],
        ['estimatedTime', 'String'], ['completed', 'Boolean =false'], ['completedAt', 'Date'],
      ],
    },
  },
  {
    n: 17, name: 'Progress', fs: 11,
    purpose: 'A mentee\'s running progress: completed resources, interview-score averages, per-topic %.',
    fields: [
      ['mentee', 'ObjectId → User, req'], ['completedResources', '[ObjectId → Resource]'],
      ['mockInterviewStats', '{ technicalScoreAvg =0,\n   hrScoreAvg =0,\n   gdScoreAvg =0 }'],
      ['topicProgress', '[{ topic → Topic,\n   percentage =0 }]'], ['updatedAt', 'Date =now'],
    ],
    about: 'Powers the analytics dashboard and makes "is this student improving?" answerable — the measurement the whole platform is built to provide.',
    relations: 'mentee → User\ncompletedResources → Resource · topic → Topic',
    indexes: '{mentee}  — looked up per student',
  },
  {
    n: 18, name: 'Notification', fs: 11,
    purpose: 'An in-app / email alert for a key event; auto-deleted after 90 days via a TTL index.',
    fields: [
      ['user', 'ObjectId → User'], ['message', 'String, required'],
      ['type', 'enum session|mock|resource|general'], ['isRead', 'Boolean =false'],
      ['link', 'String'], ['createdAt', 'Date =now'],
    ],
    about: 'Notifies users of bookings, approvals, new resources, etc. A TTL index lets MongoDB purge old notifications automatically — no cron job needed.',
    relations: 'user → User',
    indexes: '{user, createdAt: -1} · {user, isRead}\nTTL on createdAt (90 days)',
  },
];

SCHEMAS.forEach(schemaSlide);

// ════════════════════════════════════════════════════════════════════════
// SYSTEM ARCHITECTURE
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Design', 'System Architecture');
  const box = (x, y, w, h, label, sub, accent) => {
    card(s, x, y, w, h, accent);
    s.addText(label, { x: x + 0.12, y: y + 0.16, w: w - 0.24, h: 0.4, fontFace: BF, fontSize: 13.5, color: INK, bold: true, align: 'center', margin: 0 });
    if (sub) s.addText(sub, { x: x + 0.12, y: y + 0.58, w: w - 0.24, h: 0.5, fontFace: MF, fontSize: 10, color: MUTED, align: 'center', margin: 0 });
  };
  const arrow = (x, y, w) => s.addText('→', { x, y, w, h: 0.5, fontFace: BF, fontSize: 22, color: ACCENT, bold: true, align: 'center', valign: 'middle', margin: 0 });
  box(MX, 2.5, 2.9, 1.25, 'Browser (React SPA)', 'axios · Socket.IO · PeerJS', ACCENT);
  arrow(MX + 2.9, 2.88, 0.55);
  box(MX + 3.45, 2.5, 2.9, 1.25, 'Server (Node.js)', 'Express + Socket.IO', ACCENT);
  arrow(MX + 6.35, 2.88, 0.55);
  box(MX + 6.9, 2.5, 2.3, 1.25, 'Mongoose', 'ODM', SLATE);
  arrow(MX + 9.2, 2.88, 0.55);
  box(MX + 9.75, 2.5, 2.18, 1.25, 'MongoDB', 'database', ACCENT);
  const ext = [['Groq / Gemini', 'AI'], ['Judge0', 'sandbox exec'], ['WebRTC', 'P2P video'], ['SMTP', 'email']];
  ext.forEach(([t, d], i) => box(MX + i * 3.08, 4.25, 2.8, 1.05, t, d, SLATE));
  s.addText(bullets([
    'Layered server: middleware → routing → auth/validate → handler → model → error handler',
    'Stateless JWT auth → horizontally scalable; video flows peer-to-peer, not through the server',
  ], { fontSize: 13, gap: 7 }), { x: MX, y: 5.65, w: W - 2 * MX, h: 1.0, valign: 'top' });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION APPROACH
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Approach', 'Implementation Approach');
  card(s, MX, 1.95, W - 2 * MX, 1.15, ACCENT);
  s.addText([
    { text: 'Decision:  ', options: { bold: true, color: ACCENT, fontSize: 18 } },
    { text: 'harden the existing app in place — don’t rewrite.', options: { color: INK, fontSize: 18, bold: true } },
  ], { x: MX + 0.32, y: 1.95, w: W - 2 * MX - 0.6, h: 1.15, fontFace: BF, valign: 'middle', margin: 0 });
  s.addText('Feature-complete but not yet safe. Rewriting wastes working code and risks the student handoff.', {
    x: MX + 0.02, y: 3.25, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, color: MUTED, italic: true, margin: 0,
  });
  const method = [
    ['Security-first', 'Fix exploitable issues before any polish.'],
    ['Small, safe increments', 'Each change is backward-compatible and reuses shared helpers.'],
    ['Evidence before “done”', 'Nothing is marked complete without an observed test pass.'],
  ];
  s.addText('METHODOLOGY', { x: MX, y: 3.85, w: 6, h: 0.3, fontFace: MF, fontSize: 12, color: ACCENT, bold: true, charSpacing: 2, margin: 0 });
  const mw = 3.85, mgap = 0.19, my0 = 4.25;
  method.forEach(([t, d], i) => {
    const cx = MX + i * (mw + mgap);
    card(s, cx, my0, mw, 1.85);
    s.addText(t, { x: cx + 0.24, y: my0 + 0.24, w: mw - 0.45, h: 0.5, fontFace: HF, fontSize: 16, color: INK, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.24, y: my0 + 0.78, w: mw - 0.45, h: 0.9, fontFace: BF, fontSize: 12.5, color: INK_SOFT, margin: 0, valign: 'top' });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// WORK COMPLETED — P0 & P1
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Work Completed', 'Foundations & Security');
  card(s, MX, 2.05, 5.85, 4.15, ACCENT);
  s.addText('FOUNDATIONS', { x: MX + 0.32, y: 2.28, w: 5, h: 0.4, fontFace: MF, fontSize: 13, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Boot-time environment validation (fail fast)',
    'Structured logging + per-request request IDs',
    'Centralized error handling (correct 4xx vs 5xx)',
    'Reusable request validation',
    'Tiered rate limiting (auth / AI / code-exec)',
  ], { fontSize: 13, gap: 11 }), { x: MX + 0.32, y: 2.75, w: 5.3, h: 3.4, valign: 'top' });
  card(s, MX + 6.25, 2.05, 5.85, 4.15, SLATE);
  s.addText('SECURITY-CRITICAL', { x: MX + 6.57, y: 2.28, w: 5.3, h: 0.4, fontFace: MF, fontSize: 13, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Server-authoritative scoring (no forgery)',
    'Code-exec sandbox (no RCE in production)',
    'Socket.IO JWT authentication',
    'Role + ownership access control (fixed IDORs)',
    'Stored-XSS fix in emails',
    'Auth: strong passwords, lockout, reset, token invalidation',
  ], { fontSize: 13, gap: 8 }), { x: MX + 6.57, y: 2.75, w: 5.3, h: 3.4, valign: 'top' });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// PROOF / TESTS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Work Completed', 'Correctness, Scale & Proof');
  card(s, MX, 2.05, 5.5, 4.15, SLATE);
  s.addText('CORRECTNESS & SCALE', { x: MX + 0.32, y: 2.28, w: 5, h: 0.4, fontFace: MF, fontSize: 12.5, color: SLATE, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Indexes on 8 hot collections',
    '90-day TTL on notifications',
    'Atomic slot booking (race eliminated)',
    'Pagination helper',
    'MongoDB in Docker for dev & testing',
  ], { fontSize: 13, gap: 12 }), { x: MX + 0.32, y: 2.75, w: 5.0, h: 3.4, valign: 'top' });
  s.addText('VERIFIED AGAINST A REAL (DOCKER) MONGODB', { x: MX + 5.9, y: 2.22, w: 6.2, h: 0.4, fontFace: MF, fontSize: 12.5, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  const cards = [['9 / 9', 'Auth flow tests'], ['6 / 6', 'Access-control tests'], ['200 / 409', 'Booking race: one wins'], ['8', 'Index builds confirmed']];
  const cw = 2.95, ch = 1.55, gx = 0.3, gy = 0.3, x0 = MX + 5.9, y0 = 2.75;
  cards.forEach(([big, label], i) => {
    const cx = x0 + (i % 2) * (cw + gx);
    const cy = y0 + Math.floor(i / 2) * (ch + gy);
    card(s, cx, cy, cw, ch);
    s.addText(big, { x: cx + 0.12, y: cy + 0.24, w: cw - 0.24, h: 0.8, fontFace: HF, fontSize: 30, color: ACCENT, bold: true, align: 'center', margin: 0 });
    s.addText(label, { x: cx + 0.12, y: cy + 1.04, w: cw - 0.24, h: 0.4, fontFace: BF, fontSize: 12, color: MUTED, align: 'center', margin: 0 });
  });
  s.addText('Nothing claimed “done” without observing the test pass.', { x: MX + 5.9, y: 6.32, w: 6.2, h: 0.3, fontFace: BF, fontSize: 12, italic: true, color: MUTED, align: 'center', margin: 0 });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// NEW CAPABILITIES — the Copilot stack (features to be added)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Features To Be Added', 'Beyond Week 1 — New Capabilities');
  s.addText('Layered on top of the secured foundations — turning PRISM from a toolbox into a guided, agentic prep coach.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  const feats = [
    ['PRISM Copilot', 'An agentic chat front-door that books mentors, builds roadmaps, helps with résumés and answers questions across the platform.'],
    ['Prep-Readiness Spine', 'A live readiness score across five skill pillars — aptitude, DSA, CS core, communication, résumé — from every attempt.'],
    ['Daily Plan', 'A short, rule-based plan (max 4 items) that tells a student exactly what to do next — no guesswork.'],
    ['Mentor Review Queue', 'Mentors grade submitted work in one place; each result feeds back into the student’s skill signals.'],
    ['Résumé Canvas', 'Draft, AI-refine and export a résumé inside a live editing canvas, side by side with the chat.'],
    ['In-chat Code Sandbox', 'Run code and generate artifacts directly inside the assistant conversation, results kept with the thread.'],
  ];
  const cols = 3, cw = 3.78, ch = 1.95, gx = 0.27, gy = 0.32, x0 = MX, y0 = 2.4;
  feats.forEach(([t, d], i) => {
    const cx = x0 + (i % cols) * (cw + gx);
    const cy = y0 + Math.floor(i / cols) * (ch + gy);
    card(s, cx, cy, cw, ch);
    s.addText(t, { x: cx + 0.26, y: cy + 0.24, w: cw - 0.45, h: 0.5, fontFace: HF, fontSize: 16, color: INK, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.26, y: cy + 0.78, w: cw - 0.48, h: ch - 0.92, fontFace: BF, fontSize: 12, color: INK_SOFT, valign: 'top', margin: 0, lineSpacingMultiple: 1.02 });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// PRISM COPILOT — how the agent works (flow + guardrails)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Features To Be Added', 'PRISM Copilot — How It Works');
  s.addText('One chat surface over ~65 endpoints: the assistant plans a step, fetches grounded data, and proposes actions you approve.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 14, color: ACCENT, italic: true, margin: 0,
  });
  // top strip
  fnode(s, MX, 2.4, 3.0, 0.85, 'You ask in chat', null, { accent: ACCENT, tfs: 13 });
  hArrow(s, MX + 3.02, 2.825, 0.38, null, ACCENT);
  fnode(s, MX + 3.4, 2.4, 3.0, 0.85, 'LLM plans a step', null, { accent: SLATE, tfs: 13 });
  vArrow(s, MX + 3.4 + 1.5, 3.25, 0.3, 'calls a tool', ACCENT);
  // READ row
  chip(s, MX, 3.62, 1.55, 0.85, 'Read', 'just ask', { tfs: 12, sfs: 9 });
  hArrow(s, MX + 1.57, 4.045, 0.33, null, ACCENT);
  fnode(s, 2.6, 3.62, 3.55, 0.85, 'Fetch grounded data', null, { accent: ACCENT, tfs: 12.5 });
  hArrow(s, 6.17, 4.045, 0.4, null, ACCENT);
  fnode(s, 6.6, 3.62, 3.7, 0.85, 'Answer + deep links in chat', null, { accent: ACCENT, tfs: 12.5 });
  // WRITE row
  chip(s, MX, 4.72, 1.55, 0.85, 'Write', 'do something', { fill: 'EBEDEE', line: SLATE, titleColor: SLATE, subColor: MUTED, tfs: 12, sfs: 9 });
  hArrow(s, MX + 1.57, 5.145, 0.33, null, SLATE);
  fnode(s, 2.6, 4.72, 2.55, 0.85, 'Propose an action', null, { accent: SLATE, tfs: 12 });
  hArrow(s, 5.17, 5.145, 0.33, null, SLATE);
  fnode(s, 5.5, 4.72, 2.55, 0.85, 'You confirm', null, { accent: ACCENT, fill: ACCENT, titleColor: 'FFFFFF', tfs: 12.5 });
  hArrow(s, 8.07, 5.145, 0.33, null, SLATE);
  fnode(s, 8.4, 4.72, 3.5, 0.85, 'Execute · server re-checks', null, { accent: SLATE, tfs: 12 });
  // guardrails
  card(s, MX, 5.85, W - 2 * MX, 1.05, ACCENT);
  s.addText('GUARDRAILS', { x: MX + 0.3, y: 5.96, w: 3, h: 0.3, fontFace: MF, fontSize: 11, color: ACCENT, bold: true, charSpacing: 1, margin: 0 });
  s.addText('Write tools propose, never mutate  ·  every write needs your confirmation  ·  the server re-checks role & ownership on execute  ·  pasted documents are treated as data, not instructions (prompt-injection guard).', {
    x: MX + 0.3, y: 6.28, w: W - 2 * MX - 0.6, h: 0.55, fontFace: BF, fontSize: 12.5, color: INK_SOFT, valign: 'top', margin: 0, lineSpacingMultiple: 1.0,
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// PLANNED IMPROVEMENTS & FEATURES  (added before the closing slide)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Planned Work', 'Platform Hardening Roadmap');
  s.addText('Engineering work to carry both the foundations and the new capabilities to college-wide, production-grade reliability.', {
    x: MX, y: 1.82, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: ACCENT, margin: 0,
  });
  const groups = [
    ['Scale & Correctness', ['Redis for realtime scale', 'Pagination on all lists', 'Hardened AI JSON parsing', 'Remaining atomic writes']],
    ['Realtime & UX Polish', ['TURN video for strict NATs', 'Reconnect realtime wiring', 'Responsive / mobile pass', 'Loading & error states']],
    ['Reliability', ['Automated test suite', 'Health & metrics endpoints', 'Backups & restore drill', 'Monitoring & alerts']],
    ['Deploy & Handoff', ['Dockerized prod deploy', 'nginx (TLS) + PM2', 'Deployment runbook & docs', 'Handoff guide for next batch']],
  ];
  const cw = 2.82, gap = 0.18, x0 = MX, y0 = 2.3, ch = 4.05;
  groups.forEach(([theme, items], i) => {
    const cx = x0 + i * (cw + gap);
    card(s, cx, y0, cw, ch);
    s.addText(theme, { x: cx + 0.24, y: y0 + 0.3, w: cw - 0.42, h: 0.8, fontFace: HF, fontSize: 16, color: INK, bold: true, margin: 0, valign: 'top' });
    s.addText(bullets(items, { fontSize: 12, gap: 10 }), { x: cx + 0.26, y: y0 + 1.3, w: cw - 0.5, h: ch - 1.45, valign: 'top' });
  });
  footer(s);
})();

// ════════════════════════════════════════════════════════════════════════
// CLOSING — THANK YOU  (dark; "What's Next" removed per request)
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = darkSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color: ACCENT } });
  s.addShape(pres.shapes.RECTANGLE, { x: 1.1, y: 2.55, w: 0.6, h: 0.14, fill: { color: ACCENT_DK } });
  s.addText('Thank you', { x: 1.1, y: 2.85, w: 11, h: 1.2, fontFace: HF, fontSize: 60, color: ON_DARK, bold: true, margin: 0 });
  s.addText('What PRISM is · Workflows & flowcharts · Requirements · Database (18 schemas + relationships) · Architecture · Secured foundations · New agentic capabilities', {
    x: 1.13, y: 4.25, w: 11.2, h: 0.6, fontFace: BF, fontSize: 14, color: ON_DARK_MUT, margin: 0,
  });
  s.addShape(pres.shapes.LINE, { x: 1.15, y: 5.15, w: 11, h: 0, line: { color: '3A464C', width: 1 } });
  s.addText('L. Melvin Denish  ·  CSE  ·  Week 1 Review  ·  Questions welcome', { x: 1.13, y: 5.4, w: 11, h: 0.4, fontFace: BF, fontSize: 13, color: ON_DARK_MUT, margin: 0 });
})();

const OUT = process.env.DECK_OUT || 'PRISM_Week1_Review.pptx';
pres.writeFile({ fileName: OUT }).then((f) => console.log('WROTE', f, '·', pageNo, 'slides'));
