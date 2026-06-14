# PRISM Prepare-Architecture Overhaul — Design Spec

**Date:** 2026-06-12
**Status:** Approved in brainstorming (Approach A — signal spine)
**Audience:** Real students/mentors at the user's college this placement season — reliability and genuine usefulness over demo flash.

## Relationship to the existing Copilot plan

The 5-phase Copilot plan (`~/.claude/plans/it-just-says-that-vectorized-quill.md` — persistent chat, real artifacts, resume canvas base, manual/agent sidebar split, per-user theming) **stays verbatim as Phases 1–5**. The manual-feature split is untouched: Topics, Resources, Learning Paths, Coding Questions, Interview Game, STAR Bank, Review Queue, Find Mentors, Sessions, GD, Companies remain manual pages. This spec adds Phases 6–11.

## Problem

Every prepare feature works in isolation. The Interview Game generates generic questions; GD picks random topics and the live rooms give zero feedback; learning paths don't know what the user is weak at; mentor search ignores the user's target company; the resume is write-only. Nothing the user does in one feature informs any other.

## Core architecture: target-first via a signal spine

Two new collections, one shared service layer. Deterministic — **no LLM in scoring**.

### Pillars (fixed enum)

`aptitude` · `dsa` · `cs_core` (DBMS/OS/CN/OOP) · `communication` (HR/GD/behavioral) · `resume`

### `server/models/PrepProfile.js` — one per mentee

```js
{
  user: ObjectId (ref User, unique),
  targetRole: String,                      // "Frontend Engineer", "SDE", "Data Analyst"
  targetCompanies: [{ company: ObjectId|null, name: String, priority: Number }],
  timeline: { firstInterviewAt: Date },
  readiness: {                             // derived; recomputed on signal emit
    overall: Number,                       // 0–100
    pillars: {                             // one entry per pillar
      aptitude: { score: Number, trend: 'up'|'flat'|'down', sampleCount: Number, updatedAt: Date },
      // dsa, cs_core, communication, resume — same shape
    }
  },
  dailyPlan: { date: Date, items: [{ kind, title, link, reason, done }], generatedAt: Date }
}
```

- **Lazy creation**: auto-created on first `GET /api/prep-profile`, seeded from `User.aimingCompany` and the C7 onboarding diagnostic. No migration for existing users.
- Onboarding (C7) writes/updates the PrepProfile at completion.

### `server/models/SkillSignal.js` — append-only event log

```js
{
  user: ObjectId, pillar: enum, skill: String,   // free tag: 'arrays', 'dbms', 'rebuttal'
  score: Number (0–1), weight: Number,           // mock interview > single MCQ
  source: 'interview_game'|'coding'|'ai_interview'|'gd_solo'|'gd_live'
        |'review'|'resume_analysis'|'diagnostic'|'mentor_feedback',
  sourceId: ObjectId, at: Date
}
// index { user: 1, pillar: 1, at: -1 }
```

### `server/agent/services/signals.js` — shared by routes and agent tools

- `emit(userId, signals[])` — insert signals, recompute affected pillar(s) onto PrepProfile.
- `readiness(userId)` — weighted mean per pillar with **exponential time-decay (half-life 14 days)**; trend compares last 7 days vs. prior window. Deterministic and explainable.
- `readiness.overall` = unweighted mean of the 5 pillar scores (pillars with `sampleCount === 0` are excluded and the dashboard shows them as "no data yet").
- Default source weights (constant map in `signals.js`): `mentor_feedback` 3, `ai_interview` 2.5, `gd_solo` 2, `interview_game` 1.5, `coding` 1.5, `diagnostic` 1.5, `resume_analysis` 1, `review` 0.75, `gd_live` 0.5.

### `server/agent/services/dailyPlan.js` — rule-based, no LLM

Candidate order: due ReviewItems → weakest-pillar activity (game round / coding set / GD) → upcoming-session prep → resume gaps. Cap 4 items, each with deep-link and a template-phrased `reason`. Regenerated on demand or when stale (> 1 day).

### Wiring (one `emit()` call per existing scored route)

| Source route | Pillars emitted |
|---|---|
| Interview Game round grading | aptitude / cs_core / dsa / communication per round |
| Code submissions (tracker) | dsa |
| AI mock-interview rubric eval | communication, cs_core |
| GD scorecard (new, P9) | communication |
| Review queue `applyReview` | item's pillar |
| Resume analysis score | resume |
| Onboarding diagnostic | seeds all pillars |
| Mentor post-session rating (P10) | rated pillars (highest weight) |

### API

`GET /api/prep-profile` (auto-create) · `PUT /api/prep-profile` (edit target/timeline) · `POST /api/prep-profile/plan/refresh` · `POST /api/prep-profile/plan/:itemId/done`. All `protect`-ed, mentee-scoped.

---

## Feature designs

### Resume canvas (extends plan Phase 3)

`ResumeDraft` remains the structured source of truth; export remains Phase 2 artifacts.

1. **Click-to-edit** — the live preview is the editor. Any bullet/heading/summary swaps to an inline input on click → `PATCH /api/resume-builder/drafts/:id/section` (field-path + value). The manual wizard stays behind the "advanced" toggle.
2. **NL commands** — Phase 3 `/refine`, extended: response includes `changedSections[]` so the canvas flash-highlights diffs.
3. **JD tailoring** — `POST /api/resume-builder/drafts/:id/tailor` with a pasted job description → creates a **linked variant draft** (`parentDraft` ref, named for the company/role). Hallucination guard: the prompt may only reorder/rephrase/re-emphasize existing content; missing JD skills return as a separate `gaps[]` array rendered as suggestions, never inserted into the resume. Gaps emit a `resume` signal and can spawn learning-path steps.
4. **Version history** — `revisions: [{ at, label, snapshot }]` on ResumeDraft; auto-snapshot before every refine/tailor; cap 20; one-click restore.
5. **ATS chip** — existing `resumeAnalysis` service runs against the draft on demand; score shown in canvas header; emits `resume` signal.
6. **Structured-only contract** — every LLM edit returns full draft JSON (fence-strip pattern), schema-validated before save; parse failure rejects the edit and keeps the previous draft.

### Interview Game → placement simulator

1. `/start` accepts `{ company?, role? }`, defaulting from PrepProfile.
2. **`server/utils/gameTemplates.js`** — maps a company prep track (C1) to round composition `{ rounds: [{ type, count, categoryWeights, difficulty }] }`; falls back to 4 role-family templates (SDE / frontend / data / core-CS). Round *types* unchanged (aptitude, technical MCQs, coding, HR) so existing grading, attempts, and code execution are untouched.
3. **Bank-first sourcing** — curated `QuestionBank` filtered by template categoryWeights + difficulty served first; Groq generation only fills shortfalls, with role/company context in the prompt. (Generated MCQs are the least reliable component; real users get curated questions by default.)
4. **Difficulty seeds from readiness** — existing B3 difficulty defaults to the relevant pillar score; user-overridable.
5. **Personalized HR round** — generated from target-company context + STAR-bank coverage gaps.
6. **Post-game** — per-round signals, wrong answers → ReviewItems tagged with the company, report screen (per-round score vs. company expectation, weakest skills, deep-links).

### Group Discussion — both surfaces

**Solo AI GD:**
- Topics from target industry/company context (PrepProfile); custom topic retained.
- Moderator voice structures phases (opening → discussion → closing); personas explicitly instructed to rebut the candidate's latest argument.
- **`POST /api/group-discussion/evaluate`** — existing `evalCompletion` + rubric pattern → scores {initiation, content, rebuttal, clarity, balance} + 2 concrete improvements. Persisted in new **`GDSession`** model `{ user, topic, transcript, scores, feedback, createdAt }` → history/trends; emits `communication` signals; weak areas → review queue.

**Live GD rooms (no STT infrastructure):**
- Client-side **talk-time tracking** from WebRTC audio levels (speaking duration, turn count, interruptions) posted to server at session end.
- Opt-in **self-transcript** via browser Web Speech API (user's own mic only).
- Post-session AI summary + per-participant feedback from talk-time (+ transcript where available), saved on `GDRoom`; emits lower-weight `communication` signals.
- Timer/warning machinery untouched.

### Mentorship

1. **Ranked matching** — mentor list scored by: target-company overlap (mentor `currentCompany`/history vs. user targets) + expertise vs. user's weakest pillars + rating + availability. Pure sort/filter (no LLM), with visible "why this mentor" chips.
2. **Session prep packet** — on booking, deterministic template brief for the mentor: mentee target, readiness snapshot, last 3 activities, weakest skills, resume link, suggested focus. `GET /api/mentorship/sessions/:id/brief`, mentor-only.
3. **Post-session** — completion form for both sides; mentor quick-rates pillars (1–5 → `mentor_feedback` signals, highest weight); mentee one-click converts agreed items into learning-path steps / review items.

### Readiness Hub (mentee dashboard)

- Overall readiness ring, 5 pillar cards with trend arrows, interview-date countdown, 4-item daily-plan checklist (deep-links, done-toggles), recent-activity feed.
- Copilot read tools `get_readiness` / `get_daily_plan` over the same services (chat and dashboard can never disagree); write tool `set_prep_target` behind the propose→confirm gate.

---

## Phasing (each ships + verifies independently, one commit per phase)

| Phase | Scope | Depends on |
|---|---|---|
| 1–5 | Existing Copilot plan, verbatim | — |
| 6 | Prep spine: models, services, emit() wiring, prep-profile API | — |
| 7 | Resume canvas extras: click-to-edit, tailor+gaps, revisions, ATS chip | 2, 3 |
| 8 | Targeted Interview Game: templates, bank-first, readiness difficulty, HR personalization, report | 6 |
| 9 | GD upgrade: solo scorecard + GDSession; live talk-time + post-session feedback | 6 |
| 10 | Mentorship: ranking, prep packet, post-session action items | 6 |
| 11 | Readiness Hub: dashboard rebuild, daily plan UI, Copilot tools | 6 (richer after 8–10) |

## Error handling & guardrails

- Signals `emit()` failures are logged but never fail the parent request (scoring is best-effort; the activity result is canonical).
- All LLM JSON responses use the existing fence-strip + `JSON.parse` + schema-validation pattern; invalid → reject and keep prior state.
- LLM is **never** in the scoring path (readiness, matching, daily plan are deterministic).
- New routes follow `{ success, ...data }` shape, `protect` + role gates, ownership scoping by `req.user._id`.
- Client API calls only through `client/src/services/api.js` named exports.

## Verification (manual, per phase — no test runner configured)

- **P6:** Complete a game round / code submission → `GET /api/prep-profile` shows updated pillar score + sampleCount; signals visible in DB; readiness changes sensibly with wins/losses.
- **P7:** Click a resume bullet → edit inline → persists. Paste a JD → variant draft with gaps list (no invented skills). Refine → changed section highlights. Restore a revision. ATS chip updates.
- **P8:** Start game with a tracked company → round mix matches its template; bank questions served before generated ones; wrong answers appear in Review Queue; report deep-links work.
- **P9:** Finish a solo GD → scorecard renders + GDSession saved + trend visible after 2 sessions. Live room → talk-time stats and post-session summary appear for participants.
- **P10:** Mentor list reorders given a target company; booked session shows brief to mentor only; post-session rating moves the mentee's pillar; action item lands in learning path.
- **P11:** Dashboard shows readiness + daily plan; checking off items persists; Copilot `get_readiness` matches dashboard numbers exactly.

---

## Implementation status

- **P6 — DONE** (commits `69d56fb`…`c87b02c`, `feat(spine)`): models, signals + dailyPlan services, prep-profile API, emit() wiring across 5 routes.
- **P7 — DONE** (commits `3724ffb` server, `486a044` client, `feat(prepare)`): resume canvas extras.
  - Schema: `ResumeDraft` gained `parentDraft`, `targetCompany/Role`, `gaps[]`, `atsScore/atsCheckedAt`, `revisions[]` (cap 20).
  - Service (`agent/services/resume.js`): `applySectionEdit` (whitelisted field paths), `tailorDraft` (forks a JD-targeted variant; gaps come from the deterministic keyword/Gemini analysis — never the LLM; assertNoInvention guard), `atsCheckDraft` (on-demand score + gaps cache, emits `resume` signal), `restoreRevision`; `refineDraft` now snapshots before editing.
  - Routes: `PATCH /drafts/:id/section`, `POST /drafts/:id/tailor`, `POST /drafts/:id/ats`, `GET /drafts/:id/revisions`, `POST /drafts/:id/revisions/:revId/restore`.
  - Client: live preview is a click-to-edit editor; Tailor card (company/role + gaps chips); ATS chip; History drawer with restore.
  - Verified e2e against local Mongo + LLM via `server/seeds/verifyResumeCanvas.js` (all checks pass; tailor produced gaps `[kubernetes, cloud]` with no invention; ATS keyword fallback scored 78).
- **P8 — DONE** (server commit `5e46fb5` `feat(prepare)`; client commit this session): targeted Interview Game.
  - Server: `utils/gameTemplates.js` (`resolveTemplate` + `difficultyFromReadiness`); `/start` accepts `{ companyFocus?, company?, role?, difficulty? }`, defaulting targeting from PrepProfile and seeding difficulty from readiness when omitted; bank-first weighted sampling (`sampleWeighted`); `/submit-round` queues wrong answers into `ReviewItem`s (returns `reviewItemsAdded`) and emits per-round pillar signals; `GET /:id/report` returns per-round-vs-pillar breakdown, weakest rounds, company/role context, and `dueReviewCount`.
  - Client (`InterviewGame.jsx`): start screen gains a company picker (from `getCompanies`) + role input + an Auto/Easy/Medium/Hard difficulty selector (Auto omits difficulty so the server seeds it from readiness); the final scorecard renders the Performance Report (target context, weakest skills, review tally) with a deep-link to `/review`; the elimination screen surfaces queued-review items. `api.js` gains `getGameReport`.
  - Verified — **server logic, runtime**: `seeds/verifyTargetedGame.js` against local Docker mongo (`mongodb://127.0.0.1:27017/prism`) passes 15/15 — template resolution (Google→sde/hard, TCS→core/easy, Data Analyst→data, explicit-difficulty override, readiness→difficulty), category-weighted bank sampling (10/10 from weighted categories, no dupes), and wrong-answer→company-tagged `ReviewItem` with `sourceKey` dedup. Client compiles (`npm run build`) with no new lint on changed lines. **Still owed — browser pass on the running client**: company picker populates from `/companies`, Performance Report renders on a completed full game, and the `/review` deep-link navigates.
- **P9a — DONE** (commits `f5a4909` server, `e026682` client, `6a99c39` verify; plan `docs/superpowers/plans/2026-06-13-p9a-solo-gd-scoring.md`): solo GD scoring made server-authoritative + persisted.
  - `GDSession` model (server-computed scores/feedback/transcript, single-use + game-bound).
  - `/group-discussion/evaluate` persists a GDSession from its server-graded scores, returns `gdSessionId`; new `GET /group-discussion/history`.
  - `/interview-game/submit-round` GD round reads its score from the GDSession (id-looked-up, user-owned, game-bound, single-use) instead of `req.body.aiScore` — **closes the client-trusted-score hole** for GD (HR/live-AI-interview still on `aiScore`, noted as remaining debt).
  - Client: GD round submits `gdSessionId`; round-result GD scorecard (wires the previously-dead `gdEval`); GD list in the History tab.
  - Verified — runtime: `seeds/verifyP9aGD.js` 4/4 against local mongo (forged client `aiScore` cannot inflate the round; single-use/game-bound; appears in history). Client build green, no new lint. **Owed: browser smoke** (play a GD round → scorecard renders → History shows it).
  - **Descoped from P9 spec (deliberate):** moderator phases/persona-rebut prompts; GD weak-areas → review queue (free-text, not `ReviewItem`-shaped); separate `gd_solo` signal (the in-game round already emits `communication` via `interview_game`, now on the honest score).
- **P9b (live GD: WebRTC talk-time + Web Speech + post-session summary) — TODO** (own writing-plans pass).
- **P10–P11 — TODO** (each needs its own writing-plans pass first).
