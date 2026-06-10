# PRISM — Runtime / Functional Test Report

**Date:** 2026-06-09
**Branch:** `wip/pre-m1-working-changes`
**Method:** Live dev run — server (`:5000`) + Vite client (`:5173`) against a seeded database. Exercised the UI in a real browser (Chrome DevTools MCP) as **mentee, mentor, and admin**, plus direct API probes with auth tokens. Captured console errors, network status codes, and end-to-end flow behaviour.
**Complements:** `PRISM_Codebase_Audit.md` (that was static read-only review; this is dynamic, run-it-and-watch testing).

> Severity: 🔴 Blocker · 🟠 High · 🟡 Medium · ⚪ Low / polish

---

## 0. How it was run (environment findings)

### 🔴 E1 — The configured MongoDB Atlas cluster is dead; server won't boot
`server/.env` points `MONGODB_URI` at `clusterforprism.nvsgdsg.mongodb.net`. DNS resolution of its SRV record returns **NXDOMAIN** (non-existent domain — the cluster was deleted/renamed, not a transient outage; general internet/DNS works). On boot the server logs `❌ MongoDB Connection Error: querySrv ENOTFOUND …` and the process exits — so `:5000` never starts and **nothing functional can run** out of the box.

- **Workaround used for this test:** pointed the server at a local Docker `mongo:7` (`mongodb://127.0.0.1:27017/prism`) via an env override (dotenv `override:false` lets a pre-set `process.env.MONGODB_URI` win without editing `.env`), then ran `seedAll.js` + `seedQuestionBank.js`. The dead URI in `.env` was left untouched.
- **Action:** provision a fresh Atlas cluster (or document a local-Mongo dev path in `CLAUDE.md`/README). Consider letting the server start in a degraded/read-error mode instead of `process.exit` so the frontend is at least diagnosable.

### 🟠 E2 — Gemini API key quota is exhausted (breaks Resume ATS Analysis)
A direct call to `generativelanguage.googleapis.com/.../gemini-2.0-flash` with the configured `GEMINI_API_KEY` returns **HTTP 429 — "You exceeded your current quota … limit: 0"**. The free tier is zeroed. This is the trigger for bug **R1** below. (`GROQ_API_KEY`, by contrast, is **valid** — verified with a live AI-interview generation.)

---

## 1. Runtime functional bugs (new — not in the static audit)

### 🟠 R1 — Resume ATS Analysis silently returns a zeroed, useless result
[server/routes/resumeAnalysis.js:34-94](server/routes/resumeAnalysis.js#L34-L94), client [pages/ResumeAnalysis.jsx:23-28](client/src/pages/ResumeAnalysis.jsx#L23-L28)

With a key present, the route calls Gemini and only parses output when `text.match(/\{[\s\S]*\}/)` succeeds. But:
- It **never checks `response.ok`.** A 429/403 error body is valid JSON with no `candidates`, so `text=''`, no JSON match, and the code falls through leaving `matchScore:0, missingKeywords:[], suggestions:'', …` — which it then **persists to the DB** as a "successful" analysis (HTTP 201).
- The keyword-matching fallback only runs in the `else` branch (**key absent**) — it does **not** run when Gemini is present-but-failing. So a rate-limited/invalid key yields a 0% analysis instead of degrading to keyword matching.
- The client's submit handler is `catch (err) { console.error(err); }` — **no user-facing error**. On any failure the page silently reverts to its empty state.

**Observed (reproduced in-browser, admin user, both fields populated — DOM value lengths 92/94 confirmed):** Analyze → `POST /api/resume-analysis 201` → the result panel renders **"ATS Match Score 0%"** with **"⚠️ Needs significant improvement"**, no missing keywords, no suggestions, and **no error message**; History counter incremented `(0)→(1)`, i.e. the zeroed analysis was **persisted**. So a user pasting a well-matched résumé is shown a confident, wrong **0%** with no explanation. **Net:** the feature is effectively broken right now (E2) and fails *silently and misleadingly*. **Fix:** check `response.ok`; on any Gemini failure fall back to keyword matching (don't gate the fallback on key-absence); surface errors in the UI.

> Note: one earlier in-browser attempt returned `400` instead (React state hadn't settled before submit) — a separate, minor input-timing rough edge, not the core bug. The clean repro above is the canonical R1 behaviour.

### 🟡 R2 — Interview Game "practice" mode always says "✅ Passed!" regardless of score
[client/src/pages/InterviewGame.jsx:332-336](client/src/pages/InterviewGame.jsx#L332-L336), result UI [:959-968](client/src/pages/InterviewGame.jsx#L959-L968)

The fail branch is `if (mode === 'full' && data.roundScore < passScore) setPhase('failed'); else setPhase('round-result')`. In single/practice mode the first condition is always false, so **every** practice round renders "✅ {Round} Passed!" — even scores far below the round's own advertised cutoff. **Observed:** answered 1/15 aptitude questions → scored **7/100** → screen said *"✅ Aptitude Test Passed!"* (cutoff shown elsewhere as 40%). Misleading. **Fix:** evaluate `roundScore >= passScore` in practice mode too (or relabel practice results as "Round Complete" with a pass/fail badge, not an unconditional "Passed!").

### 🟡 R3 — Mentor & admin see the **mentee** dashboard body
[client/src/pages/Dashboard.jsx:87](client/src/pages/Dashboard.jsx#L87)

The only role-aware line in `Dashboard.jsx` is the subtitle string. Everything else renders identically for all roles, so a **mentor** sees: quick-actions "Interview Game / Start a mock interview" and "Resume Builder / Build your resume", and stat tiles "GAMES PLAYED / AVG GAME SCORE / LEARNING PATHS / RESOURCES DONE 0/50" — none relevant to a mentor, and several link to pages that aren't even in the mentor's own sidebar. **Fix:** branch the dashboard body by role (mentor: pending requests, upcoming sessions, mentee roster, ratings; mentee: current behaviour).

### 🟡 R4 — "Coding Questions" page is a dead-end catalog
[client/src/pages/CodingQuestions.jsx](client/src/pages/CodingQuestions.jsx)

The page lists 25 problems but cards have **no click/solve/view handler** — only difficulty filters and (mentor/admin) an "Add" button. A mentee can read titles but cannot open, attempt, or run anything. The code-execution engine works (see V-checks) but is only reachable from the realtime interview room, not here. **Fix:** either link each card to a solve view/editor, or relabel the page so it doesn't imply interactivity. (Relates to the deferred `codeSubmissions` feature, audit I1.)

### 🟡 R5 — Seed data: coding-question topics are assigned round-robin (nonsensical tags)
[server/seeds/seedAll.js:268](server/seeds/seedAll.js#L268) — `topic: topics[i % topics.length]._id`

Topics are stapled to questions by array index, not subject. Result in the UI: *"Climbing Stairs" → String Algorithms*, *"Best Time to Buy and Sell Stock" → Graph Theory*, *"LRU Cache" → Web Development*, *"Regular Expression Matching" → Database Management*. Same `i % topics.length` pattern appears for other seeded collections (`:334`, `:380`). It makes "filter by topic" meaningless and looks broken to users. **Fix:** map each seed question to a sensible topic explicitly.

---

## 2. UX / polish

| ID | Finding | Location |
|---|---|---|
| ⚪ R6 | Browser tab title is **"client"** (default Vite scaffold) on every page — never branded to "PRISM". | `client/index.html` `<title>` |
| ⚪ R7 | `/companies` is routed and shown in the **admin** nav, but there's **no nav link for mentees** even though the route is reachable by URL. Decide if mentees should see it; if yes, add the link; if no, gate it. | `App.jsx:68`, `components/Layout` nav |
| ⚪ R8 | Orphaned **client** pages — `AIInterview.jsx`, `GDRooms.jsx`, `MockInterviews.jsx` exist but are never imported/routed in `App.jsx`. Dead code (mirrors the server-side orphans in audit I1). | `client/src/pages/` |
| ⚪ R9 | Silent client error handling — confirmed in Resume Analysis (`catch { console.error }`); audit-style sweep recommended for other pages so failed requests show a toast, not nothing. | `pages/ResumeAnalysis.jsx:28` et al. |
| ⚪ R10 | React **StrictMode** double-invokes effects in dev, so every page fetches each data endpoint twice on mount (`200` then `304`). Dev-only, harmless, but worth confirming effects are idempotent (no double POSTs on action handlers). | `client/src/main.jsx` |
| ⚪ R11 | Mentor Sessions list renders the mentee's email (`meera@prism.dev`). Defensible inside an established relationship, but it comes from the `/api/mentorship` populate, which is **not** using the public projection that S3 added to `/users/:id` — inconsistent data exposure policy. | `routes/mentorship.js` populate |

---

## 3. Audit-fix runtime verification (what actually held up when run)

The static audit's §6 "Remediation Status" was only `node --check`'d. Verified live:

| Audit item | Runtime result |
|---|---|
| **S1** SSRF guard on `/api/summarize` | ✅ **Verified live** — `http://169.254.169.254/latest/meta-data/` and `http://127.0.0.1:5000/api/auth/me` both rejected with `400 "URL resolves to a blocked address"`; control `http://example.com/` fetched + summarized. Post-DNS private/loopback block holds. |
| **S3** `/users/:id` public projection | ✅ email **not** leaked for other users — **but** `linkedin` + `github` **are** still returned to non-owners (audit said reserve those too → partial). |
| **S4** `aiLimiter` wired to AI routes | ✅ Present on ai-interview/GD/game/resume-builder/learning-paths/summarize (40 req / 15 min). GROQ key live & generating. |
| **S5** server-graded MCQ | ⚠️ **Only aptitude verified** — confirmed the *aptitude* round is server-graded (client score ignored). **Did NOT** exercise the specific S5 cases: `technical2` grading or the client-trusted `coding`/`gd`/`hr` rounds that feed the leaderboard. Treat S5 as *not fully re-verified*. |
| **S6** regex input escaping | ✅ `?company=(a+)+$` returned `200` fast — no ReDoS hang. |
| Code execution + `DANGEROUS_PATTERNS` | ✅ JS→`4`, Python→`42`; `require('fs')` correctly **blocked** ("restricted operations"). All local compilers (node/python/g++/javac) on PATH. |
| Role gating (client + server) | ✅ mentee → `/admin` redirects to `/dashboard`; `GET /api/users` with mentee token → **403** "Role 'mentee' is not authorized". |

## 4. Happy-path flows confirmed working

- Login (all 3 roles), auth redirect, JWT persistence.
- **Booking:** mentee → View Slots → pick slot → agenda → Confirm → "Session booked …" ✅, appears in Sessions.
- **Mentor approve:** Sessions → Approve → `PATCH /status 200`, list refreshes ✅.
- **Admin Panel:** user/topic/company counts, user table with delete, Users/Topics tabs ✅.
- **Interview Game:** aptitude round loads 15 real MCQs, timer, question navigator, server scoring ✅ (modulo R2 labelling).
- **Resume Builder** `/generate` (GROQ) returns real content ✅.
- Dashboard, Topics, Resources, Learning Paths, Mentors, Sessions, Analytics, Notifications, Coding Questions all render with **zero console errors** and all data requests `200/304`.

---

## 4a. Not tested / coverage caveats (gaps, not failures)

These were out of scope for this pass — call them out so §3/§4 aren't read as full coverage:
- **S2 (socket room authorization)** — not exercised. Needs a scripted Socket.IO client joining another user's `sessionId` as a non-participant; a single headless browser can't reach this. **Highest-value remaining check.**
- **Full Interview Game beyond aptitude** — `coding`, `gd`, `hr`, `technical2` rounds and the elimination/leaderboard path (and thus the S5 client-trusted-score concern) were not played end-to-end.
- **Auth edges** — Registration, Forgot-password / Reset-password not run. Email is silently disabled without `EMAIL_USER/PASS`, so forgot-password would "succeed" without sending — verify the UX there.
- **Realtime/WebRTC** — 1:1 video call, GD video rooms, technical interview coding room (PeerJS) need ≥2 concurrent clients; not tested.
- **`/api/summarize`** — only the SSRF guard was probed, not normal summarization UX (and it has no routed client page).
- **Resume Builder** — `/generate` confirmed via API; the full builder UI (drafts, cover-letter, PDF/print) not click-tested.

## 5. Priority

**Before any demo/deploy**
1. 🔴 E1 — restore a working MongoDB (Atlas cluster gone). Without it the app is dead on arrival.
2. 🟠 E2 + R1 — Resume ATS Analysis: renew Gemini quota **and** fix the silent-failure path (`response.ok`, real fallback, UI error).

**Next**
3. 🟡 R3 — give mentor/admin a real dashboard.
4. 🟡 R2 — correct practice-mode pass/fail labelling.
5. 🟡 R4 / R5 — make Coding Questions interactive (or relabel); fix nonsensical seed topic tags.

**Polish**
6. ⚪ R6–R11 — tab title/branding, `/companies` nav decision, delete orphaned client pages, user-facing error toasts, projection consistency on session populate.
