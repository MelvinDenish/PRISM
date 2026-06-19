/**
 * Hand-crafted GOLD-STANDARD resume exemplars — few-shot references injected into the
 * design prompt. Each is a complete, self-contained HTML document at the EXACT quality
 * bar we want the model to match, in a DIFFERENT design system from the catalog. Content
 * is fictional placeholder data (different candidates than any fixture, so the model
 * imitates the DESIGN, not the words).
 *
 * Both are deliberately COLOR-RICH and STRUCTURED (a teal two-column sidebar + a cobalt
 * header band) — the vision critic (and recruiters) reward visual composition over plain
 * editorial text, and these references exist specifically to pull generated resumes AWAY
 * from the boring centered-name/underlined-caps template.
 *
 * Validated by server/seeds/verifyResumeQuality.js: each must render ≤2 A4 pages AND
 * score strongly (not "looksGeneric") on the vision critic. Kept compact — they ride
 * along on every proposer + repair call (token cost).
 */

// 1) "Modern Geometric" — full-height teal sidebar (contact/skills/education) + wide main.
const EX_SIDEBAR = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Work Sans',sans-serif;color:#111827;background:#fff;font-size:11px;line-height:1.5}
.r{display:flex;width:794px;min-height:1040px;margin:0 auto}
.side{width:250px;background:#0f766e;color:#fff;padding:36px 26px}
.main{flex:1;padding:38px 34px}
.namewrap{border-bottom:2px solid #99f6e4;padding-bottom:13px;margin-bottom:6px}
h1{font-family:'Space Grotesk',sans-serif;font-size:35px;font-weight:700;letter-spacing:-.8px;color:#0f172a;line-height:1.02}
.role{font-family:'Space Grotesk',sans-serif;color:#0f766e;font-size:13px;font-weight:600;margin-top:5px;letter-spacing:.4px;text-transform:uppercase}
.side h2{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.3px;color:#a7f3d0;margin-bottom:9px}
.main h2{font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0f766e;border-bottom:2px solid #99f6e4;padding-bottom:5px;margin:20px 0 11px}
.side section{margin-bottom:24px}
.side a,.side p{color:#d1fae5;font-size:10.5px;line-height:1.75;display:block;text-decoration:none}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.chip{background:rgba(255,255,255,.15);color:#fff;padding:3px 9px;border-radius:11px;font-size:10px}
.deg{font-weight:700;color:#fff;font-size:11px}
.summary{color:#374151;font-size:11px;line-height:1.62}
.entry{margin-bottom:13px}
.top{display:flex;justify-content:space-between;align-items:baseline}
.ttl{font-weight:700;font-size:12px;color:#0f172a}
.date{color:#6b7280;font-size:10px;white-space:nowrap}
.org{color:#0f766e;font-size:11px;font-weight:600;margin-bottom:3px}
.desc{color:#4b5563;font-size:10.5px;line-height:1.55}
.tech{color:#0f766e;font-size:10px;margin-top:2px;font-weight:500}
</style></head><body><div class="r">
<aside class="side">
<section><h2>Contact</h2><a>priya.nair@example.com</a><a>+91 90123 45678</a><a>Bengaluru, India</a><a>linkedin.com/in/priyanair</a><a>github.com/priyanair</a></section>
<section><h2>Skills</h2><div class="chips"><span class="chip">Java</span><span class="chip">Python</span><span class="chip">Go</span><span class="chip">React</span><span class="chip">Node.js</span><span class="chip">PostgreSQL</span><span class="chip">Docker</span><span class="chip">Kubernetes</span><span class="chip">AWS</span><span class="chip">Redis</span></div></section>
<section><h2>Education</h2><p class="deg">B.E. Computer Science</p><p>R.V. College of Engineering</p><p>2021 – 2025 &bull; CGPA 9.1</p><p style="margin-top:6px">Class XII: 93% &bull; Class X: 95%</p></section>
<section><h2>Achievements</h2><p>Winner, Smart India Hackathon 2024</p><p>Google Summer of Code, 2024</p></section>
</aside>
<main class="main">
<div class="namewrap"><h1>Priya Nair</h1><div class="role">Backend &amp; Distributed Systems Engineer</div></div>
<section><h2>Summary</h2><p class="summary">Final-year CSE student specializing in backend and distributed systems, with internship experience building high-throughput services. Happiest designing reliable APIs and data pipelines that hold up under real load.</p></section>
<h2>Experience</h2>
<div class="entry"><div class="top"><span class="ttl">Backend Engineering Intern</span><span class="date">May – Aug 2024</span></div><div class="org">Razorpay</div><div class="desc">Built an idempotent webhook-delivery service handling 2M+ events/day; cut duplicate deliveries to near-zero with a Redis-backed dedup layer and added structured retries with exponential backoff.</div></div>
<div class="entry"><div class="top"><span class="ttl">Open-Source Contributor</span><span class="date">2023 – 2024</span></div><div class="org">Apache Kafka</div><div class="desc">Contributed consumer-group rebalancing fixes and expanded integration-test coverage for the group coordinator.</div></div>
<h2>Projects</h2>
<div class="entry"><div class="top"><span class="ttl">ShardKV</span></div><div class="desc">A sharded, replicated key-value store with Raft consensus and linearizable reads; supports dynamic re-sharding with no downtime.</div><div class="tech">Go &middot; Raft &middot; gRPC &middot; RocksDB</div></div>
<div class="entry"><div class="top"><span class="ttl">StreamLens</span></div><div class="desc">A real-time analytics pipeline ingesting clickstream events and serving sub-second windowed aggregations.</div><div class="tech">Python &middot; Kafka &middot; Flink &middot; ClickHouse</div></div>
<h2>Positions of Responsibility</h2>
<div class="entry"><div class="desc">Backend Lead, college coding club — mentored 30+ juniors and ran weekly system-design sessions.</div></div>
</main></div></body></html>`;

// 2) "Bold Header Band" — cobalt full-bleed header, Archivo/Public Sans, marker headings + chips.
const EX_HEADERBAND = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Public Sans',sans-serif;color:#1f2937;background:#fff;font-size:11px;line-height:1.55}
.r{width:794px;min-height:1040px;margin:0 auto}
.band{background:#1d4ed8;color:#fff;padding:34px 48px}
.band h1{font-family:'Archivo',sans-serif;font-size:38px;font-weight:800;letter-spacing:-.5px;line-height:1}
.band .role{font-family:'Archivo',sans-serif;font-size:13px;font-weight:600;color:#bfdbfe;margin-top:6px;text-transform:uppercase;letter-spacing:1px}
.band .contact{margin-top:13px;font-size:10.5px;color:#dbeafe;display:flex;gap:16px;flex-wrap:wrap}
.body{padding:28px 48px}
h2{font-family:'Archivo',sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1d4ed8;margin:19px 0 11px;display:flex;align-items:center;gap:8px}
h2:before{content:"";width:11px;height:11px;background:#1d4ed8;display:inline-block;border-radius:2px}
.first{margin-top:2px}
.summary{font-size:11.5px;color:#374151;line-height:1.62}
.entry{margin-bottom:13px}
.top{display:flex;justify-content:space-between;align-items:baseline}
.ttl{font-weight:700;font-size:12px;color:#111827}
.org{color:#1d4ed8;font-weight:600}
.date{color:#9ca3af;font-size:10px;white-space:nowrap}
.desc{color:#4b5563;font-size:10.5px;line-height:1.55;margin-top:2px}
.tech{color:#1d4ed8;font-size:10px;margin-top:2px;font-weight:500}
.cols{display:flex;gap:40px}.cols>div{flex:1}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:500}
</style></head><body><div class="r">
<div class="band"><h1>Ananya Iyer</h1><div class="role">Full-Stack Engineer</div><div class="contact"><span>ananya.iyer@example.com</span><span>+91 99887 76655</span><span>Hyderabad, India</span><span>linkedin.com/in/ananyaiyer</span><span>github.com/ananyaiyer</span></div></div>
<div class="body">
<h2 class="first">Summary</h2><p class="summary">Final-year CSE student who ships end-to-end product features — from React front-ends to Node services and the data model underneath. Internship-tested, with a bias for clean APIs and fast, accessible UIs.</p>
<h2>Experience</h2>
<div class="entry"><div class="top"><span><span class="ttl">Full-Stack Intern</span> &middot; <span class="org">Swiggy</span></span><span class="date">May – Aug 2024</span></div><div class="desc">Built a merchant self-onboarding flow end-to-end, cutting manual onboarding steps sharply; shipped the React UI, the Node/Express APIs, and the Postgres schema with tests.</div></div>
<div class="entry"><div class="top"><span><span class="ttl">Frontend Developer (Freelance)</span> &middot; <span class="org">Local NGO</span></span><span class="date">2023</span></div><div class="desc">Rebuilt a donation portal as an accessible, mobile-first PWA; lifted Lighthouse performance and accessibility scores into the 90s.</div></div>
<h2>Projects</h2>
<div class="entry"><div class="top"><span class="ttl">DevBoard</span></div><div class="desc">A real-time collaborative kanban board with presence, optimistic updates, and offline sync; supports multi-cursor editing over WebSockets.</div><div class="tech">React &middot; Node.js &middot; Socket.IO &middot; PostgreSQL</div></div>
<div class="entry"><div class="top"><span class="ttl">SnapNote</span></div><div class="desc">A notes app that turns handwritten photos into searchable markdown using on-device OCR, with full-text search across notes.</div><div class="tech">React Native &middot; FastAPI &middot; Tesseract &middot; SQLite</div></div>
<div class="cols">
<div><h2>Skills</h2><div class="chips"><span class="chip">JavaScript</span><span class="chip">TypeScript</span><span class="chip">React</span><span class="chip">Node.js</span><span class="chip">Express</span><span class="chip">PostgreSQL</span><span class="chip">Docker</span><span class="chip">AWS</span><span class="chip">Git</span></div></div>
<div><h2>Education</h2><div class="entry"><div class="top"><span class="ttl">B.E. Computer Science</span><span class="date">2021–2025</span></div><div class="desc">IIIT Hyderabad — CGPA 9.0 &middot; Class XII 94% &middot; Class X 96%</div></div></div>
</div>
<h2>Achievements</h2><p class="desc">Winner, Flipkart GRiD 2024 &middot; 3-star Codeforces &middot; Microsoft Learn Student Ambassador</p>
</div></div></body></html>`;

const EXEMPLARS = [EX_SIDEBAR, EX_HEADERBAND];

/** Prompt fragment embedding the exemplars as few-shot quality references. */
function exemplarBlock() {
  return [
    'QUALITY REFERENCES — the resumes below are at the EXACT quality bar to match (different candidates, different design systems). Study their typographic hierarchy, spacing rhythm, color discipline, and layout. Produce work at THIS level, but in YOUR OWN distinct design system — do NOT copy their fonts, colors, or content.',
    ...EXEMPLARS.map((html, i) => `--- REFERENCE ${i + 1} ---\n${html}`),
  ].join('\n\n');
}

module.exports = { EXEMPLARS, exemplarBlock };
