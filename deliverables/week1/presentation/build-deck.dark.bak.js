/*
 * Builds the native PowerPoint for the PRISM Week 1 review.
 * Run:  NODE_PATH="$(npm root -g)" node build-deck.js
 * Output: PRISM_Week1_Review.pptx
 *
 * Theme: PRISM brand — emerald/teal on a dark teal-black background.
 */
const pptxgen = require('pptxgenjs');

// ── Palette (PRISM brand) ────────────────────────────────────────────────
const BG      = '0A1A1C'; // deep teal-black
const PANEL   = '12262B'; // card background
const PANEL2  = '0F2226'; // alt card background
const EMERALD = '10B981';
const TEAL    = '14B8A6';
const MINT    = '5EEAD4';
const TEXT    = 'E6EDEC'; // off-white
const MUTED   = '93A8A6'; // muted teal-grey
const BORDER  = '1E3A3F';
const DANGER  = 'F87171';

const HF = 'Trebuchet MS'; // header font
const BF = 'Calibri';      // body font

const W = 13.333, H = 7.5; // LAYOUT_WIDE
const MX = 0.7;            // side margin

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'L. Melvin Denish';
pres.company = 'CSE Department';
pres.title = 'PRISM — Week 1 Review';

const shadow = () => ({ type: 'outer', color: '000000', blur: 8, offset: 3, angle: 135, opacity: 0.35 });

// ── Reusable pieces ──────────────────────────────────────────────────────
function baseSlide() {
  const s = pres.addSlide();
  s.background = { color: BG };
  return s;
}

function footer(s, n) {
  s.addText('PRISM · Placement Resources & Interview Skill Manager', {
    x: MX, y: H - 0.45, w: 8, h: 0.3, fontFace: BF, fontSize: 9, color: MUTED, align: 'left', margin: 0,
  });
  s.addText(String(n), {
    x: W - 1.2, y: H - 0.45, w: 0.5, h: 0.3, fontFace: BF, fontSize: 9, color: MUTED, align: 'right', margin: 0,
  });
}

// Title block with the brand motif (two stacked squares) instead of an accent underline.
function header(s, kicker, title) {
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: 0.62, w: 0.14, h: 0.34, fill: { color: EMERALD } });
  s.addShape(pres.shapes.RECTANGLE, { x: MX + 0.2, y: 0.62, w: 0.14, h: 0.34, fill: { color: TEAL } });
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: MX + 0.5, y: 0.55, w: 11, h: 0.3, fontFace: BF, fontSize: 12, color: TEAL, bold: true, charSpacing: 2, margin: 0,
    });
  }
  s.addText(title, {
    x: MX, y: 1.0, w: W - 2 * MX, h: 0.9, fontFace: HF, fontSize: 32, color: TEXT, bold: true, margin: 0,
  });
}

// A content card with a thin left accent bar.
function card(s, x, y, w, h, accent, fill) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || PANEL }, line: { color: BORDER, width: 1 }, shadow: shadow() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h, fill: { color: accent || TEAL } });
}

const bullets = (items, opts = {}) => items.map((t) => ({
  text: t, options: { bullet: { code: '2022', indent: 14 }, color: opts.color || TEXT, fontSize: opts.fontSize || 14,
    fontFace: BF, breakLine: true, paraSpaceAfter: opts.gap != null ? opts.gap : 8 },
}));

// ════════════════════════════════════════════════════════════════════════
// 1 · TITLE
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: H, fill: { color: EMERALD } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 0, w: 0.1, h: H, fill: { color: TEAL } });

  s.addText('PRISM', { x: 1.1, y: 2.1, w: 9, h: 1.4, fontFace: HF, fontSize: 76, color: EMERALD, bold: true, charSpacing: 2, margin: 0 });
  s.addText('Placement Resources & Interview Skill Manager', {
    x: 1.13, y: 3.5, w: 11, h: 0.6, fontFace: BF, fontSize: 22, color: TEXT, margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 1.15, y: 4.3, w: 3.2, h: 0.5, fill: { color: PANEL }, line: { color: TEAL, width: 1 } });
  s.addText('WEEK 1  ·  INTERNSHIP REVIEW', { x: 1.15, y: 4.3, w: 3.2, h: 0.5, fontFace: BF, fontSize: 12, color: MINT, bold: true, align: 'center', valign: 'middle', charSpacing: 1, margin: 0 });

  s.addText([
    { text: 'L. Melvin Denish', options: { bold: true, color: TEXT, fontSize: 14, breakLine: true } },
    { text: 'CSE · 3rd Year · June 2026', options: { color: MUTED, fontSize: 12 } },
  ], { x: 1.13, y: 5.4, w: 8, h: 0.8, fontFace: BF, margin: 0 });
})();

// ════════════════════════════════════════════════════════════════════════
// 2 · AGENDA
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Overview', 'Agenda');
  const items = [
    ['01', 'Understanding the project'],
    ['02', 'The problem & objectives'],
    ['03', 'Users & proposed workflow'],
    ['04', 'System requirements'],
    ['05', 'Database design'],
    ['06', 'System architecture'],
    ['07', 'Implementation approach'],
    ['08', 'Work completed (with proof)'],
  ];
  const cols = 2, cw = 5.7, ch = 0.92, gx = 0.4, gy = 0.32, x0 = MX, y0 = 2.1;
  items.forEach(([num, label], i) => {
    const cx = x0 + (i % cols) * (cw + gx);
    const cy = y0 + Math.floor(i / cols) * (ch + gy);
    card(s, cx, cy, cw, ch, i % 2 ? TEAL : EMERALD);
    s.addText(num, { x: cx + 0.18, y: cy, w: 0.9, h: ch, fontFace: HF, fontSize: 26, color: i % 2 ? TEAL : EMERALD, bold: true, valign: 'middle', margin: 0 });
    s.addText(label, { x: cx + 1.1, y: cy, w: cw - 1.2, h: ch, fontFace: BF, fontSize: 15, color: TEXT, valign: 'middle', margin: 0 });
  });
  footer(s, 2);
})();

// ════════════════════════════════════════════════════════════════════════
// 3 · WHAT IS PRISM
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Understanding', 'What is PRISM?');
  s.addText('One platform for the entire campus-placement preparation journey.', {
    x: MX, y: 1.85, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 15, color: MINT, italic: true, margin: 0,
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
    card(s, cx, cy, cw, ch, i % 2 ? TEAL : EMERALD, PANEL);
    s.addText(t, { x: cx + 0.22, y: cy + 0.2, w: cw - 0.35, h: 0.5, fontFace: HF, fontSize: 16, color: TEXT, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.22, y: cy + 0.72, w: cw - 0.35, h: 0.6, fontFace: BF, fontSize: 12, color: MUTED, margin: 0 });
  });
  footer(s, 3);
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
    card(s, cx, y0, cw, ch, DANGER, PANEL);
    s.addText('0' + (i + 1), { x: cx + 0.25, y: y0 + 0.25, w: 1.5, h: 0.7, fontFace: HF, fontSize: 30, color: DANGER, bold: true, margin: 0 });
    s.addText(t, { x: cx + 0.25, y: y0 + 1.0, w: cw - 0.5, h: 0.5, fontFace: HF, fontSize: 20, color: TEXT, bold: true, margin: 0 });
    s.addText(d, { x: cx + 0.25, y: y0 + 1.55, w: cw - 0.5, h: 0.85, fontFace: BF, fontSize: 13, color: MUTED, margin: 0 });
  });
  s.addText([
    { text: 'PRISM  ', options: { bold: true, color: EMERALD, fontSize: 16 } },
    { text: '= one role-based, auditable platform that fixes all three.', options: { color: TEXT, fontSize: 16 } },
  ], { x: MX, y: 5.1, w: W - 2 * MX, h: 0.6, fontFace: BF, align: 'center', valign: 'middle', margin: 0 });
  footer(s, 4);
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
  card(s, MX, 2.1, 5.85, 3.7, EMERALD, PANEL);
  card(s, MX + 6.25, 2.1, 5.85, 3.7, TEAL, PANEL);
  s.addText(bullets(left, { fontSize: 15, gap: 14 }), { x: MX + 0.3, y: 2.4, w: 5.3, h: 3.2, valign: 'top' });
  s.addText(bullets(right, { fontSize: 15, gap: 14 }), { x: MX + 6.55, y: 2.4, w: 5.3, h: 3.2, valign: 'top' });
  s.addText('Week 1 focus', { x: MX + 6.55, y: 5.25, w: 5, h: 0.4, fontFace: BF, fontSize: 12, italic: true, color: MINT, margin: 0 });
  footer(s, 5);
})();

// ════════════════════════════════════════════════════════════════════════
// 6 · USERS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Understanding', 'Users — Three Roles');
  const roles = [
    ['Mentee', EMERALD, ['Book mentorship sessions', 'Practise AI interviews & the Game', 'Build & analyze résumés', 'Study resources, track progress']],
    ['Mentor', TEAL, ['Publish availability', 'Teach 1:1 and group mocks', 'Upload trusted resources', 'Give structured feedback']],
    ['Admin', MINT, ['Manage users & content', 'Curate topics / companies', 'Moderate the platform', 'View platform-wide analytics']],
  ];
  const cw = 3.85, ch = 3.5, gx = 0.45, x0 = MX, y0 = 2.1;
  roles.forEach(([name, accent, items], i) => {
    const cx = x0 + i * (cw + gx);
    card(s, cx, y0, cw, ch, accent, PANEL);
    s.addShape(pres.shapes.OVAL, { x: cx + 0.25, y: y0 + 0.28, w: 0.5, h: 0.5, fill: { color: accent } });
    s.addText(name, { x: cx + 0.9, y: y0 + 0.25, w: cw - 1.0, h: 0.55, fontFace: HF, fontSize: 20, color: TEXT, bold: true, valign: 'middle', margin: 0 });
    s.addText(bullets(items, { fontSize: 13, gap: 9 }), { x: cx + 0.3, y: y0 + 1.05, w: cw - 0.55, h: 2.3, valign: 'top' });
  });
  s.addText('Roles are enforced on the SERVER, on every action.', { x: MX, y: 5.8, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, italic: true, color: MINT, align: 'center', margin: 0 });
  footer(s, 6);
})();

// ════════════════════════════════════════════════════════════════════════
// 7 · WORKFLOW
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Proposed Workflow', 'The Core Mentorship Loop');
  const steps = [
    ['Set availability', 'Mentor'],
    ['Browse & book', 'Mentee'],
    ['Approve / reject', 'Mentor'],
    ['Join video call', 'Both'],
    ['Complete', 'System'],
    ['Rate each other', 'Both'],
  ];
  const bw = 1.78, bh = 1.5, gap = 0.26, x0 = MX, y0 = 2.6;
  steps.forEach(([t, who], i) => {
    const cx = x0 + i * (bw + gap);
    const accent = i % 2 ? TEAL : EMERALD;
    card(s, cx, y0, bw, bh, accent, PANEL);
    s.addText(String(i + 1), { x: cx + 0.15, y: y0 + 0.12, w: 0.6, h: 0.5, fontFace: HF, fontSize: 22, color: accent, bold: true, margin: 0 });
    s.addText(t, { x: cx + 0.15, y: y0 + 0.6, w: bw - 0.3, h: 0.55, fontFace: BF, fontSize: 12.5, color: TEXT, bold: true, margin: 0 });
    s.addText(who, { x: cx + 0.15, y: y0 + 1.12, w: bw - 0.3, h: 0.3, fontFace: BF, fontSize: 10, color: MUTED, margin: 0 });
    if (i < steps.length - 1) {
      s.addText('›', { x: cx + bw - 0.02, y: y0, w: gap + 0.04, h: bh, fontFace: HF, fontSize: 22, color: TEAL, bold: true, align: 'center', valign: 'middle', margin: 0 });
    }
  });
  s.addText('Atomic booking — no two mentees can grab the same slot. Plus solo AI practice anytime.', {
    x: MX, y: 4.6, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, color: MINT, italic: true, align: 'center', margin: 0,
  });
  footer(s, 7);
})();

// ════════════════════════════════════════════════════════════════════════
// 8 · ACCESS MODEL
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Proposed Workflow', 'Access Model — Role AND Ownership');
  const head = (t) => ({ text: t, options: { fill: { color: PANEL2 }, color: MINT, bold: true, fontSize: 13, align: 'center', valign: 'middle' } });
  const cell = (t, c, left) => ({ text: t, options: { color: c || TEXT, fontSize: 13, align: left ? 'left' : 'center', valign: 'middle' } });
  const Y = 'Yes', N = '—';
  const rows = [
    [head('Capability'), head('Mentee'), head('Mentor'), head('Admin')],
    [cell('Browse resources', TEXT, true), cell(Y, EMERALD), cell(Y, EMERALD), cell(Y, EMERALD)],
    [cell('Edit / delete a resource', TEXT, true), cell(N, MUTED), cell('Own only', TEAL), cell('Any', EMERALD)],
    [cell('Book a session', TEXT, true), cell(Y, EMERALD), cell(N, MUTED), cell(N, MUTED)],
    [cell('Approve a session', TEXT, true), cell(N, MUTED), cell(Y, EMERALD), cell(N, MUTED)],
    [cell('Admin panel', TEXT, true), cell(N, MUTED), cell(N, MUTED), cell(Y, EMERALD)],
  ];
  s.addTable(rows, {
    x: MX, y: 2.15, w: W - 2 * MX, colW: [5.93, 2, 2, 2], rowH: 0.52,
    fill: { color: PANEL }, color: TEXT, border: { type: 'solid', color: BORDER, pt: 1 },
    align: 'center', valign: 'middle', fontFace: BF,
  });
  s.addText([
    { text: '“Own only” ', options: { bold: true, color: TEAL, fontSize: 14 } },
    { text: '= an ownership check on the specific record, not just a role check — the key security idea.', options: { color: TEXT, fontSize: 14 } },
  ], { x: MX, y: 5.7, w: W - 2 * MX, h: 0.5, fontFace: BF, align: 'center', valign: 'middle', margin: 0 });
  footer(s, 8);
})();

// ════════════════════════════════════════════════════════════════════════
// 9 · SYSTEM REQUIREMENTS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Specification', 'System Requirements');
  card(s, MX, 2.05, 5.85, 4.1, EMERALD, PANEL);
  card(s, MX + 6.25, 2.05, 5.85, 4.1, TEAL, PANEL);
  s.addText('FUNCTIONAL', { x: MX + 0.3, y: 2.25, w: 5, h: 0.4, fontFace: HF, fontSize: 15, color: EMERALD, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Authentication & profiles',
    'Mentorship: availability, booking, sessions, ratings',
    'Interview practice: AI, Game, coding, GD',
    'Résumé builder & ATS analysis',
    'Resource library & learning paths',
    'Progress, analytics, notifications, admin',
  ], { fontSize: 13, gap: 8 }), { x: MX + 0.3, y: 2.7, w: 5.3, h: 3.3, valign: 'top' });

  s.addText('NON-FUNCTIONAL  (production-grade)', { x: MX + 6.55, y: 2.25, w: 5.3, h: 0.4, fontFace: HF, fontSize: 15, color: TEAL, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Auth + role/ownership on every endpoint',
    'No score forgery · sandboxed code · authed realtime',
    'Fail-fast config · structured errors · request tracing',
    'Indexed queries · pagination · atomic writes',
    'Rate limiting · secrets never leaked',
    'Self-hostable & student-maintainable',
  ], { fontSize: 13, gap: 8 }), { x: MX + 6.55, y: 2.7, w: 5.3, h: 3.3, valign: 'top' });
  footer(s, 9);
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
  const rh = 0.62, x0 = MX, y0 = 2.05, lw = 2.6, rw = W - 2 * MX - lw;
  rows.forEach(([k, v], i) => {
    const cy = y0 + i * (rh + 0.06);
    s.addShape(pres.shapes.RECTANGLE, { x: x0, y: cy, w: lw, h: rh, fill: { color: i % 2 ? TEAL : EMERALD } });
    s.addText(k, { x: x0 + 0.15, y: cy, w: lw - 0.25, h: rh, fontFace: HF, fontSize: 14, color: BG, bold: true, valign: 'middle', margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + lw + 0.08, y: cy, w: rw - 0.08, h: rh, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
    s.addText(v, { x: x0 + lw + 0.28, y: cy, w: rw - 0.45, h: rh, fontFace: BF, fontSize: 12.5, color: TEXT, valign: 'middle', margin: 0 });
  });
  footer(s, 10);
})();

// ════════════════════════════════════════════════════════════════════════
// 11 · DATABASE DESIGN
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Design', 'Database Design');
  card(s, MX, 2.05, 6.0, 4.15, EMERALD, PANEL);
  s.addText('PRINCIPLES', { x: MX + 0.3, y: 2.25, w: 5, h: 0.4, fontFace: HF, fontSize: 15, color: EMERALD, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'MongoDB (document DB) via Mongoose schemas',
    'Embed data owned by its parent (rounds, slots, résumé sections)',
    'Reference shared entities (User, Topic, Company, Resource)',
    'Index only fields real queries touch → O(log n), not O(n)',
    'TTL index auto-purges old notifications',
    'Atomic single-document writes guard integrity',
  ], { fontSize: 13, gap: 9 }), { x: MX + 0.3, y: 2.7, w: 5.5, h: 3.4, valign: 'top' });

  const rx = MX + 6.45, rw = 5.65;
  card(s, rx, 2.05, rw, 4.15, TEAL, PANEL2);
  s.addText('18 COLLECTIONS · CENTERED ON USER', { x: rx + 0.3, y: 2.25, w: rw - 0.5, h: 0.4, fontFace: HF, fontSize: 13, color: TEAL, bold: true, charSpacing: 1, margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: rx + rw / 2 - 0.7, y: 3.9, w: 1.4, h: 0.7, fill: { color: EMERALD }, shadow: shadow() });
  s.addText('User', { x: rx + rw / 2 - 0.7, y: 3.9, w: 1.4, h: 0.7, fontFace: HF, fontSize: 14, color: BG, bold: true, align: 'center', valign: 'middle', margin: 0 });
  const nodes = ['Mentorship', 'InterviewGame', 'Resource', 'Progress', 'ResumeDraft', 'Notification'];
  const positions = [[rx + 0.3, 3.0], [rx + rw - 1.85, 3.0], [rx + 0.3, 4.0], [rx + rw - 1.85, 4.0], [rx + 0.3, 5.0], [rx + rw - 1.85, 5.0]];
  nodes.forEach((n, i) => {
    const [nx, ny] = positions[i];
    s.addShape(pres.shapes.RECTANGLE, { x: nx, y: ny, w: 1.55, h: 0.5, fill: { color: PANEL }, line: { color: TEAL, width: 1 } });
    s.addText(n, { x: nx, y: ny, w: 1.55, h: 0.5, fontFace: BF, fontSize: 10.5, color: TEXT, align: 'center', valign: 'middle', margin: 0 });
  });
  footer(s, 11);
})();

// ════════════════════════════════════════════════════════════════════════
// 12 · ARCHITECTURE
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Design', 'System Architecture');
  const box = (x, y, w, h, label, sub, accent, fill) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || PANEL }, line: { color: accent, width: 1.5 }, shadow: shadow() });
    s.addText(label, { x: x + 0.1, y: y + 0.12, w: w - 0.2, h: 0.4, fontFace: HF, fontSize: 14, color: TEXT, bold: true, align: 'center', margin: 0 });
    if (sub) s.addText(sub, { x: x + 0.1, y: y + 0.55, w: w - 0.2, h: 0.5, fontFace: BF, fontSize: 10.5, color: MUTED, align: 'center', margin: 0 });
  };
  const arrow = (x, y, w) => s.addText('→', { x, y, w, h: 0.5, fontFace: HF, fontSize: 22, color: TEAL, bold: true, align: 'center', valign: 'middle', margin: 0 });

  box(MX, 2.5, 3.0, 1.2, 'Browser (React SPA)', 'axios · Socket.IO · PeerJS', EMERALD);
  arrow(MX + 3.05, 2.85, 0.7);
  box(MX + 3.8, 2.5, 3.0, 1.2, 'Server (Node.js)', 'Express + Socket.IO', TEAL);
  arrow(MX + 6.85, 2.85, 0.7);
  box(MX + 7.6, 2.5, 2.4, 1.2, 'Mongoose', 'ODM', TEAL);
  arrow(MX + 10.05, 2.85, 0.55);
  box(MX + 10.65, 2.5, 1.9, 1.2, 'MongoDB', 'database', EMERALD);

  const ext = [['Groq / Gemini', 'AI'], ['Judge0', 'sandbox exec'], ['WebRTC', 'P2P video'], ['SMTP', 'email']];
  ext.forEach(([t, d], i) => box(MX + i * 3.05, 4.2, 2.8, 1.0, t, d, MINT, PANEL2));

  s.addText(bullets([
    'Layered server: middleware → routing → auth/validate → handler → model → error handler',
    'Stateless JWT auth → horizontally scalable; video flows peer-to-peer, not through the server',
  ], { fontSize: 13, gap: 6 }), { x: MX, y: 5.55, w: W - 2 * MX, h: 1.0, valign: 'top' });
  footer(s, 12);
})();

// ════════════════════════════════════════════════════════════════════════
// 13 · IMPLEMENTATION APPROACH
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Approach', 'Implementation Approach');
  card(s, MX, 1.95, W - 2 * MX, 1.15, EMERALD, PANEL);
  s.addText([
    { text: 'Decision:  ', options: { bold: true, color: EMERALD, fontSize: 18 } },
    { text: 'harden the existing app in place — don’t rewrite.', options: { color: TEXT, fontSize: 18, bold: true } },
  ], { x: MX + 0.3, y: 1.95, w: W - 2 * MX - 0.6, h: 1.15, fontFace: BF, valign: 'middle', margin: 0 });

  s.addText('Feature-complete but not safe. Rewriting wastes working code and risks the student handoff.', {
    x: MX + 0.3, y: 3.2, w: W - 2 * MX, h: 0.4, fontFace: BF, fontSize: 13, color: MUTED, italic: true, margin: 0,
  });

  const phases = [['0', 'Foundations', EMERALD, 'done'], ['1', 'Security', EMERALD, 'done'], ['2', 'Scale', TEAL, 'in progress'], ['3', 'Polish', MUTED, 'next'], ['4', 'Production', MUTED, 'next']];
  const bw = 2.25, gap = 0.2, y0 = 3.95, x0 = MX;
  phases.forEach(([n, t, accent, status], i) => {
    const cx = x0 + i * (bw + gap);
    card(s, cx, y0, bw, 1.5, accent, PANEL);
    s.addText('PHASE ' + n, { x: cx + 0.2, y: y0 + 0.2, w: bw - 0.3, h: 0.35, fontFace: BF, fontSize: 11, color: accent, bold: true, charSpacing: 1, margin: 0 });
    s.addText(t, { x: cx + 0.2, y: y0 + 0.58, w: bw - 0.3, h: 0.45, fontFace: HF, fontSize: 16, color: TEXT, bold: true, margin: 0 });
    s.addText(status, { x: cx + 0.2, y: y0 + 1.05, w: bw - 0.3, h: 0.3, fontFace: BF, fontSize: 11, color: status === 'done' ? EMERALD : status === 'in progress' ? TEAL : MUTED, italic: true, margin: 0 });
  });
  footer(s, 13);
})();

// ════════════════════════════════════════════════════════════════════════
// 14 · WORK COMPLETED — P0 & P1
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Work Completed', 'Phase 0 — Foundations  ·  Phase 1 — Security');
  card(s, MX, 2.05, 5.85, 4.15, EMERALD, PANEL);
  s.addText('PHASE 0 · FOUNDATIONS', { x: MX + 0.3, y: 2.25, w: 5, h: 0.4, fontFace: HF, fontSize: 14, color: EMERALD, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Boot-time environment validation (fail fast)',
    'Structured logging + per-request request IDs',
    'Centralized error handling (correct 4xx vs 5xx)',
    'Reusable request validation',
    'Tiered rate limiting (auth / AI / code-exec)',
  ], { fontSize: 13, gap: 9 }), { x: MX + 0.3, y: 2.7, w: 5.3, h: 3.4, valign: 'top' });

  card(s, MX + 6.25, 2.05, 5.85, 4.15, TEAL, PANEL);
  s.addText('PHASE 1 · SECURITY-CRITICAL', { x: MX + 6.55, y: 2.25, w: 5.3, h: 0.4, fontFace: HF, fontSize: 14, color: TEAL, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Server-authoritative scoring (no forgery)',
    'Code-exec sandbox (no RCE in production)',
    'Socket.IO JWT authentication',
    'Role + ownership access control (fixed IDORs)',
    'Stored-XSS fix in emails',
    'Auth: strong passwords, lockout, reset, token invalidation',
  ], { fontSize: 13, gap: 7 }), { x: MX + 6.55, y: 2.7, w: 5.3, h: 3.4, valign: 'top' });
  footer(s, 14);
})();

// ════════════════════════════════════════════════════════════════════════
// 15 · PROOF / TESTS
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  header(s, 'Work Completed', 'Phase 2 (started) + Proof');
  card(s, MX, 2.05, 5.5, 4.15, TEAL, PANEL);
  s.addText('PHASE 2 · CORRECTNESS & SCALE', { x: MX + 0.3, y: 2.25, w: 5, h: 0.4, fontFace: HF, fontSize: 13, color: TEAL, bold: true, charSpacing: 1, margin: 0 });
  s.addText(bullets([
    'Indexes on 7 hot collections',
    '90-day TTL on notifications',
    'Atomic slot booking (race eliminated)',
    'Pagination helper',
    'MongoDB in Docker for dev & testing',
  ], { fontSize: 13, gap: 10 }), { x: MX + 0.3, y: 2.7, w: 5.0, h: 3.4, valign: 'top' });

  s.addText('VERIFIED AGAINST A REAL (DOCKER) MONGODB', { x: MX + 5.9, y: 2.2, w: 6.2, h: 0.4, fontFace: HF, fontSize: 13, color: MINT, bold: true, charSpacing: 1, margin: 0 });
  const cards = [['9 / 9', 'Auth flow tests', EMERALD], ['6 / 6', 'Access-control tests', TEAL], ['1 of 2', 'Booking race: one wins', EMERALD], ['100%', 'Index builds confirmed', TEAL]];
  const cw = 2.95, ch = 1.55, gx = 0.3, gy = 0.3, x0 = MX + 5.9, y0 = 2.75;
  cards.forEach(([big, label, accent], i) => {
    const cx = x0 + (i % 2) * (cw + gx);
    const cy = y0 + Math.floor(i / 2) * (ch + gy);
    card(s, cx, cy, cw, ch, accent, PANEL2);
    s.addText(big, { x: cx + 0.1, y: cy + 0.22, w: cw - 0.2, h: 0.8, fontFace: HF, fontSize: 34, color: accent, bold: true, align: 'center', margin: 0 });
    s.addText(label, { x: cx + 0.1, y: cy + 1.02, w: cw - 0.2, h: 0.4, fontFace: BF, fontSize: 12, color: MUTED, align: 'center', margin: 0 });
  });
  s.addText('Nothing claimed “done” without observing the test pass.', { x: MX + 5.9, y: 6.3, w: 6.2, h: 0.3, fontFace: BF, fontSize: 12, italic: true, color: MINT, align: 'center', margin: 0 });
  footer(s, 15);
})();

// ════════════════════════════════════════════════════════════════════════
// 16 · WHAT'S NEXT + THANK YOU
// ════════════════════════════════════════════════════════════════════════
(() => {
  const s = baseSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: H, fill: { color: EMERALD } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.18, y: 0, w: 0.1, h: H, fill: { color: TEAL } });
  s.addText('WHAT’S NEXT', { x: 1.1, y: 0.9, w: 11, h: 0.5, fontFace: BF, fontSize: 14, color: TEAL, bold: true, charSpacing: 2, margin: 0 });
  s.addText(bullets([
    'Phase 2: Redis for multi-process realtime · hardened AI JSON parsing · pagination rollout',
    'Phase 3: TURN-backed video · fix broken wires · UX polish',
    'Phase 4: backups · health/metrics · automated test suite · deployment docs',
  ], { fontSize: 15, gap: 12 }), { x: 1.13, y: 1.6, w: 11, h: 2.0, valign: 'top' });

  s.addShape(pres.shapes.LINE, { x: 1.15, y: 3.9, w: 10.8, h: 0, line: { color: BORDER, width: 1 } });

  s.addText('Thank you', { x: 1.1, y: 4.3, w: 11, h: 1.0, fontFace: HF, fontSize: 48, color: EMERALD, bold: true, margin: 0 });
  s.addText('Understanding · Workflow · Requirements · Database · Architecture · Approach  +  secured & tested foundations', {
    x: 1.13, y: 5.45, w: 11, h: 0.5, fontFace: BF, fontSize: 13, color: TEXT, margin: 0,
  });
  s.addText('L. Melvin Denish · CSE · Week 1 Review · Questions welcome', { x: 1.13, y: 6.1, w: 11, h: 0.4, fontFace: BF, fontSize: 12, color: MUTED, margin: 0 });
})();

pres.writeFile({ fileName: 'PRISM_Week1_Review.pptx' }).then((f) => console.log('WROTE', f));
