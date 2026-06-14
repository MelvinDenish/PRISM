# PRISM Overhaul — Design Spec

**Date:** 2026-06-10
**Status:** Approved (design); implementation phased.
**Branch:** `wip/pre-m1-working-changes`

## Goal

Make PRISM "rigid and perfectly working": resolve all known bugs, populate a large curated resource catalog, replace the current dark glassmorphism "AI-slop" theme with a **Clean Light Professional** design system, let users **preview resources in-app** (no redirect to source), and build a **rigid, unified meeting architecture** supporting **1:1, 1:n, and n:n** at any scale via an **SFU (LiveKit)**.

## Sequencing (phased, highest-impact first, review gate between each)

1. **Phase 1 — Fixes + Resource content** (bugs from both reports + large curated resource seed)
2. **Phase 2 — Redesign** (Clean Light Professional design system, applied app-wide)
3. **Phase 3 — In-app resource preview** (video embed + PDF embed + server reader-view for articles)
4. **Phase 4 — Meetings** (LiveKit SFU: 1:1, 1:n, n:n, role-aware)

Each phase ends with a verification pass and a user review gate.

---

## Phase 1 — Fixes + Resource content

### Bug fixes (refs: `deliverables/PRISM_Runtime_Test_Report.md`, `PRISM_Codebase_Audit.md`)
- **R1** Resume ATS Analysis silent-zero: in `routes/resumeAnalysis.js` check `response.ok`; on **any** Gemini failure fall through to the keyword-matching fallback (don't gate it on key-absence); never persist an all-zero analysis as success. Client `ResumeAnalysis.jsx`: surface an error toast instead of `catch { console.error }`.
- **R2** Interview Game practice mode labelling: evaluate `roundScore >= passScore` in single mode too; show pass/fail honestly (not unconditional "Passed!").
- **R3** Role-aware dashboard: `Dashboard.jsx` branches body by role — mentor sees pending requests, upcoming sessions, mentee roster, ratings; mentee keeps current view; admin gets an admin summary or redirect to panel.
- **R4** Coding Questions: cards open a solve view (problem + editor + run via existing `/api/code-execution`).
- **R5** Seed topic mapping: explicit, sensible topic per coding question / resource (no `i % topics.length`).
- **R6** Brand `client/index.html` `<title>` = "PRISM …" + favicon.
- **R7** `/companies` nav: add a mentee-visible link (show to all roles).
- **R8** Orphaned client pages (`AIInterview`, `MockInterviews`): delete. `GDRooms` superseded by Phase 4 (remove old PeerJS GD page when Phase 4 lands).
- **R9** App-wide client error handling: a reusable toast/notice; replace silent `catch`es on user actions.
- **R11** Session populate uses public projection where appropriate.
- Audit follow-ups where cheap: `/users/:id` also withhold linkedin/github from non-owners.

### Resource seeding (target ~150–250)
- Replace the round-robin seed block in `seeds/seedAll.js` with a dedicated curated dataset (e.g. `seeds/data/resources.js` consumed by `seedAll.js`): each item `{ title, description, topic (correct), level, resourceType (video|article|pdf|link), link }`.
- Cover every seeded topic: DSA, Algorithms, System Design, OS, DBMS, Computer Networks, OOP, Web Dev, ML, Aptitude, HR/Behavioral, Competitive Programming, plus language/tooling basics.
- Real free sources (official docs, GfG, freeCodeCamp, MIT OCW, NeetCode, CS50, well-known YouTube lectures). Mark `resourceType` accurately so Phase 3 preview routing works.

### Verification (Phase 1)
- Server boots; seed populates without error; counts logged.
- API: resume-analysis returns a real keyword score when Gemini is down; coding solve endpoint works.
- Browser: mentee + mentor + admin dashboards render correct role content; zero console errors; resource list shows the large catalog with correct topic tags.

---

## Phase 2 — Clean Light Professional design system

Tokenize in `client/src/index.css` (`:root`), then propagate.

- **Surfaces:** `--bg: #F8FAFC`, `--surface: #FFFFFF`, `--border: #E2E8F0`, soft shadow `0 1px 2px rgba(15,23,42,.06)`. No glass/blur, no gradients, no glow.
- **Ink:** `--text: #0F172A`, `--text-secondary: #475569`, `--text-muted: #94A3B8`.
- **Accent:** `--accent: #4F46E5`, `--accent-hover: #4338CA`; semantic `--success #16A34A`, `--warning #D97706`, `--danger #DC2626`.
- **Type:** Inter (or system stack), tightened scale; strong heading hierarchy.
- **Components recolored/rebuilt:** sidebar (light), cards, buttons, inputs, tables, badges, modals, score rings. Recharts series recolored.
- Sweep every page; remove `glass-card`/gradient utility usages.

### Verification (Phase 2)
- Visual pass on every route (screenshots) as each role; contrast/legibility check; no leftover dark-theme artifacts; charts readable.

---

## Phase 3 — In-app resource preview (no redirect)

Preview opens in an in-page drawer/modal; never navigates away.
- **Video**: YouTube/Vimeo `<iframe>` embed.
- **PDF**: embed via `<iframe>` or pdf.js in-app.
- **Article/link**: new server **reader-view** endpoint — extend the SSRF-guarded fetch (`utils/urlGuard.js` + `routes/summarize.js` pattern) to fetch server-side, extract main content (Readability-style), sanitize HTML, return clean content; client renders it in the drawer with an "Open original ↗" escape hatch.
- Security: reader-view reuses urlGuard (no private IPs, no internal redirects), sanitizes returned HTML (strip scripts/iframes/handlers) before render.

### Verification (Phase 3)
- A video, a PDF, and 2–3 article resources each preview fully in-app; X-Frame-blocked sites still render via reader-view; sanitization verified.

---

## Phase 4 — Meetings: unified LiveKit SFU (1:1 / 1:n / n:n)

### Architecture
- **Media:** LiveKit SFU. Local dev: LiveKit server in Docker. Prod: self-host or LiveKit Cloud.
- **One room primitive** for all topologies; topology = publish/subscribe pattern, not separate code:
  - **1:1** — both publish (mentor+mentee from a booked session).
  - **n:n** — all publish (group discussion / peer mock).
  - **1:n** — host publishes, viewers subscribe-only (webinar), enforced by token grants.
- **Token service:** Express endpoint mints scoped LiveKit JWTs. Role-aware grants: mentor/host publish + moderate (mute/remove); webinar viewers subscribe-only; participants publish. Token requires the user be authorized for that room (booked-session participant or invited member).
- **Rooms model:** a `Meeting` record (type `one_to_one | group | webinar`, host, participants/invitees, scheduledAt, livekit room name). 1:1 derived from a `MentorshipSession`; group/webinar created by a mentor.
- **Client:** `@livekit/components-react` UI (grid + speaker view, screen share, mic/cam toggle, participant list, leave; host moderation). Replaces `VideoCall.jsx` + PeerJS `GDRooms.jsx`.
- **Socket.IO** retained for presence/notifications/chat; LiveKit owns media. Remove PeerJS deps + mesh signaling once migrated.
- **Env:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (feature-gated in `config/env.js`; meetings disabled with a clear warning if unset).

### Verification (Phase 4) — real multi-client
- 1:1: two browser contexts join, see/hear each other, reconnect after a drop.
- n:n: 3 participants all publish; grid shows all; one leaves cleanly.
- 1:n: host publishes, 2 viewers subscribe-only (cannot publish); host can mute/remove.
- Authz: a non-participant is denied a token.

---

## Cross-cutting

- **Test scaffold (audit I5):** minimal runner (node:test) for server route smoke + key unit logic (urlGuard, resume fallback scoring, livekit token grants).
- **Env/docs:** document local-Mongo + LiveKit-Docker dev path in `CLAUDE.md`/README. The dead Atlas cluster (E1) is the owner's to re-provision; local Docker `prism-mongo` is the dev DB.
- **Non-goals:** product features beyond the four phases (application tracker, cohorts, etc.) remain out of scope.

## Risks
- Reader-view fidelity varies by site (accept "good enough" + escape hatch).
- LiveKit adds an infra dependency (accepted by owner).
- Redesign is broad — mitigate with a per-route visual sweep.
