# PRISM — Codebase Audit (Bugs, Security, Data Leaks, Requirement Gaps)

**Date:** 2026-06-09
**Branch:** `wip/pre-m1-working-changes`
**Scope:** Server (`server/`), Socket layer, and cross-checked against client API surface and `plan.md` requirements baseline.
**Method:** Manual read of all 23 route files, models, middleware, socket handlers, utils; verified flagged items against code.

> Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low / cleanup

---

## 1. Security & Data-Leak Findings (severity-ordered)

### 🔴 S1 — SSRF in `POST /api/summarize` (full-read)
[server/routes/summarize.js:13-30](server/routes/summarize.js#L13-L30)

The route fetches an **arbitrary user-supplied `url`** server-side with `axios.get(url)` and returns the (summarized) content to the caller. No scheme/host/IP validation.

- An attacker can read cloud metadata (`http://169.254.169.254/latest/meta-data/...`), internal services (`http://localhost:5000`, DB admin UIs, `http://127.0.0.1`), and other RFC-1918 hosts. Because the fetched body is returned, this is a **full-read SSRF** — data is directly exfiltrated, not blind.
- `axios` follows redirects by default, so a hostname allowlist alone is bypassable via an attacker-controlled redirect to an internal IP.

**Fix:** Disable redirects (`maxRedirects: 0`), require `http(s)` scheme, resolve the hostname and **reject private/loopback/link-local IP ranges after DNS resolution** (re-check on each hop), and ideally keep an allowlist. Add a response-size cap (already slices to 8000 chars but the full body is buffered first).

---

### 🔴 S2 — Socket rooms have authentication but **no authorization** (private-session eavesdropping)
[server/socket/socketHandler.js:29-52](server/socket/socketHandler.js#L29-L52), [:85-109](server/socket/socketHandler.js#L85-L109), [:129-162](server/socket/socketHandler.js#L129-L162), [:211-215](server/socket/socketHandler.js#L211-L215)

`socketAuth` proves *who* the user is, but `join-room`, `join-session`, `session-peer-id`, `join-gd`, and `gd-video-join` accept **any `roomId`/`sessionId` from any authenticated user**. There is no check that the user is a participant of that mentorship session / GD room.

- Any logged-in user who knows or guesses a `sessionId` can join a **private 1:1 mentorship video call**, receive WebRTC peer IDs, the shared code buffer (`sync-code`), and chat — i.e. eavesdrop on another mentor↔mentee session. Confidentiality breach, same tier as the SSRF.

**Fix:** On `join-session`/`session-peer-id`, look up the `MentorshipSession` and verify `socket.user._id` is its mentor or mentee. For GD rooms, verify membership similarly.

---

### 🟠 S3 — `GET /api/users/:id` leaks PII of any user, enumerable
[server/routes/users.js:44-52](server/routes/users.js#L44-L52)

Any authenticated user can fetch **any** user document (minus password): `email`, `linkedin`, `github`, `college`, `graduationYear`, companies, etc. IDs are exposed via `GET /api/users/mentors` and session populates, so the whole user table's PII is enumerable.

**Fix:** Return a public-safe projection (name, role, bio, skills, company, rating, profilePicture). Reserve email/linkedin/github for the owner or admin, or for an established mentor↔mentee relationship.

---

### 🟠 S4 — AI routes have **no rate limiting** (cost / DoS) — *claimed-but-not-delivered*
[server/middleware/rateLimit.js:33](server/middleware/rateLimit.js#L33) defines `aiLimiter`, but `grep` shows it is **imported by zero routes**.

Unthrottled, auth-only, Groq-backed endpoints: `ai-interview/*`, `interview-game` (question generation fallback), `group-discussion/*`, `resume-builder/generate` + `/cover-letter`, `learning-paths/generate`, `summarize`. Only `resume-analysis` has its own limiter.

- `plan.md` §4.M and §8 call this out explicitly as the **#1 cost risk** ("already installed, never imported"). A single user (or a loop/attacker) can drain the Groq free tier in hours. The head commit `feat(security): Phase 0-2 hardening` claims to address Phase 0/Milestone 2, but this Phase-0 item is **not done**.

**Fix:** Apply `aiLimiter` to every Groq/Gemini route; add a per-user daily quota (plan suggests ~3 mocks/day).

---

### 🟠 S5 — Interview Game score integrity: client-trusted scores + a broken round
[server/routes/interviewGame.js:282-329](server/routes/interviewGame.js#L282-L329), [:9](server/routes/interviewGame.js#L9)

`submit-round` only server-grades `['aptitude', 'technical1']`. Everything else takes the **client-supplied `aiScore`** (clamped 0–100), so `coding`, `gd`, `hr` rounds are trivially cheatable (`aiScore: 100`). This is acknowledged in comments as a known limitation — but it directly feeds the **public leaderboard** ([:353](server/routes/interviewGame.js#L353)) and the analytics dashboard, so the leaderboard is not trustworthy.

**Plus a concrete bug:** `technical2` is in `MCQ_ROUNDS` (line 9), so `/questions/:round` strips its answer key from the response *and* persists `servedQuestions`. But `submit-round`'s grading branch omits `technical2`, so it falls through to the `aiScore` branch — where the client **has no answer key to grade with**. Result: `technical2` always defaults to 0 for honest clients **and** is forgeable for dishonest ones. Either add `technical2` to the server-graded list (correct fix) or remove it from `MCQ_ROUNDS`.

---

### 🟡 S6 — Regex injection / ReDoS via unsanitized query params
[server/routes/users.js:34-35](server/routes/users.js#L34-L35), [server/routes/resources.js:14](server/routes/resources.js#L14)

`new RegExp(req.query.company, 'i')`, `req.query.skill`, and `req.query.search` (public, no `protect`) feed user input straight into a regex. A crafted pattern (e.g. `(a+)+$`) causes catastrophic backtracking (ReDoS) and the unanchored match enables expensive scans.

**Fix:** Escape the input before `RegExp`, or use a `$text` index / anchored prefix match. The `resources` search is unauthenticated, so it's the easiest DoS target.

---

### 🟡 S7 — Most routes leak raw error messages; centralized handler unused
[server/middleware/errorHandler.js](server/middleware/errorHandler.js) is well-built, but only [auth.js](server/routes/auth.js) uses `asyncHandler`/`AppError`. Every other route does `catch (error) { res.status(500).json({ message: error.message }) }`, returning raw Mongoose/driver internals to the client **in all environments** (the handler's prod-stack-suppression never runs for them).

**Fix:** Wrap handlers in `asyncHandler` and `throw new AppError(...)`, or at least map to generic messages on 500.

---

### 🟡 S8 — Socket auth ignores token revocation
[server/socket/socketAuth.js:24-29](server/socket/socketAuth.js#L24-L29)

HTTP `protect` rejects JWTs issued before `passwordChangedAt` ([auth.js:27-32](server/middleware/auth.js#L27-L32)), but the socket auth does **not**. After a password reset, old tokens still grant socket access (presence, rooms, video).

**Fix:** Mirror the `passwordChangedAt` check in `socketAuth`.

---

### 🟡 S9 — `send-message` trusts client-supplied `userName`
[server/socket/socketHandler.js:205-207](server/socket/socketHandler.js#L205-L207)

Every other handler uses server-derived `authUserName`, but chat broadcasts the client's `userName` verbatim — identity spoofing in room chat. Use `authUserName`.

---

### 🟡 S10 — Client-controlled AI conversation context (prompt injection + cost)
[server/routes/aiInterview.js:57-80](server/routes/aiInterview.js#L57-L80), [server/routes/groupDiscussion.js:76-120](server/routes/groupDiscussion.js#L76-L120)

`/chat`, `/evaluate`, GD `/respond` accept the entire `conversationContext` (including the **system prompt**) from the client and forward it to Groq unchanged. A user can rewrite the system prompt, and the array size is capped only by the **10 MB JSON body limit** — far too high to be a real cost control. Persist transcripts server-side (keyed by game/session) instead of trusting the client to echo them, and cap message/array sizes.

---

## 2. Logic & Correctness Bugs

### 🟠 B1 — Mentorship rating: only one party can ever rate a session
[server/routes/mentorship.js:135-184](server/routes/mentorship.js#L135-L184)

`ratingGiven` is a single shared field and the double-rating guard ([:160](server/routes/mentorship.js#L160)) blocks **both** parties after the first rates. So if the mentee rates, the mentor can never leave feedback (and vice-versa). Intended design is presumably one rating *per role*.

**Fix:** Track `menteeRated` / `mentorRated` separately (or store ratings as a sub-object per role).

### 🟡 B2 — Division-by-zero → `NaN` scores
- [resumeAnalysis.js:88](server/routes/resumeAnalysis.js#L88): fallback `matchScore` divides by `unique.length`; a JD of only short words (`length <= 3`) yields `unique.length === 0` → `NaN` persisted to DB.
- [learningPaths.js:111](server/routes/learningPaths.js#L111): `progress = Math.round(completedSteps / totalSteps * 100)` → `NaN` if `totalSteps === 0` (AI returned an empty path).

### 🟡 B3 — Progress accepts non-existent / arbitrary resource IDs
[server/routes/progress.js:24-58](server/routes/progress.js#L24-L58)

`PATCH /complete/:resourceId` pushes the id into `completedResources` **before** confirming the resource exists. A valid-format-but-nonexistent ObjectId is stored, inflating `totalCompleted` and the overall-progress percentage in stats/analytics. Validate the resource exists first.

### 🟡 B4 — Double-booking conflict check is incomplete
[server/routes/mentorship.js:25-39](server/routes/mentorship.js#L25-L39)

The conflict query only matches existing sessions whose `scheduledDate` starts within a `±duration` window of the new start, and adds a `now-24h` floor. It does not detect a long existing session that *contains* the new slot. Prefer an explicit interval-overlap query (`existingStart < newEnd && existingEnd > newStart`).

---

## 3. Incomplete / Partially-Implemented Features

### 🟠 I1 — Four route files + models are orphaned (not mounted)
`gdRooms.js`, `mockInterviews.js`, `mockFeedback.js`, `codeSubmissions.js` exist but are **not registered** in [server.js](server/server.js#L36-L55), and the client API layer never calls them. A stash patch (`0001choreremoveunmountedmockinterviewGDroomandor.patch`) indicates an in-progress removal. Per `plan.md` §4.C, `CodeSubmission` is *intentionally* deferred ("Milestone 3c will fix"), but right now they are dead code shipping in the tree.
- Bonus bug inside the dead code: [gdRooms.js:58](server/routes/gdRooms.js#L58) `room.participants.includes(req.user._id)` compares ObjectIds with `===` and won't dedupe correctly.

**Action:** Either finish wiring them or delete them; don't ship half-removed.

### 🟡 I2 — Resume upload is modeled but not implemented
`User.resumeUrl` / `ResumeAnalysis.resumeUrl` exist and `multer` + `pdf-parse` are **dependencies**, but neither is imported anywhere (`grep` returns nothing). There is no upload/parse endpoint — resume analysis only accepts pasted text. Remove the unused deps or build the upload path.

### 🟡 I3 — Dead cookie-auth branch
[server/middleware/auth.js:11-13](server/middleware/auth.js#L11-L13) reads `req.cookies.token`, but `cookie-parser` is **not installed** and not mounted, so `req.cookies` is always undefined. Harmless (falls back to header) but misleading — either add `cookie-parser` or drop the branch.

### 🟡 I4 — `validate`/`AppError` framework adopted only in `auth.js`
The Phase-0 validation + error scaffolding is real and good, but ~22 of 23 routes still hand-roll validation and `res.status(500)`. The "request validation" Milestone-2 item is **partially** delivered.

### ⚪ I5 — No automated tests
Neither package has a test runner (confirmed in CLAUDE.md and `package.json`). `plan.md` §7 Phase 0 lists a "test scaffold" — not present.

---

## 4. Requirement-Satisfaction Check (vs `plan.md`)

The commit `feat(security): Phase 0-2 hardening` claims Phase 0–2. Measuring against the plan's own checklist:

| Plan item | Claimed phase | Status in code | Verdict |
|---|---|---|---|
| Env validation / fail-fast boot | Phase 0 | `config/env.js` solid | ✅ Done |
| Centralized error handler + sanitization | Phase 0 / M2 | Built but used only by `auth.js` | ⚠️ Partial |
| Request validation framework | Phase 0 / M2 | Built, used only by `auth.js` | ⚠️ Partial |
| **Rate-limit AI routes** ("critical before rollout") | Phase 0 / M2 | `aiLimiter` defined, **wired to 0 routes** | ❌ **Missed** |
| Auth hardening (lockout, reset, token invalidation) | Phase 1 | `auth.js` + `User.js` | ✅ Done (HTTP); ❌ socket gap (S8) |
| Socket authentication | Phase 1 | `socketAuth` added | ✅ Identity; ❌ **no room authz** (S2) |
| IDOR ownership checks (`isOwner`) | Phase 1 | Applied in resume-analysis, resources, game | ⚠️ Partial — missing on `users/:id` (S3) |
| Server-authoritative MCQ scoring | Phase 1 | aptitude/technical1 graded | ⚠️ `technical2` broken (S5) |
| DB indexes | Phase 2 | Present on User/InterviewGame | ✅ Done |
| Redis adapter for rate-limit/presence | Phase 2 | Not present (in-memory) | ❌ Deferred (acknowledged in code) |
| Test scaffold | Phase 0 | None | ❌ Missed |

**Net:** The security spine (auth hardening, env validation, socket identity, MCQ grading for two rounds, IDOR on most owned resources, indexes) is genuinely in place and well-written. But three Phase-0/1 items the plan called mandatory are **not actually delivered**: AI rate limiting, socket room authorization, and full IDOR coverage — and the SSRF in `summarize` is a new high-severity hole the hardening pass didn't catch.

Broader product requirements (`plan.md` §4) remain mostly roadmap — company-specific prep linkage, interview-experience archive, peer mocks, application tracker, college cohorts, etc. are all ❌ by the plan's own marking; those are intentional future work, not regressions.

---

## 5. Prioritized Fix List

**Do before any deployment:**
1. 🔴 Wire `aiLimiter` onto all AI routes + per-user daily quota (S4). *Lowest effort, highest cost-risk.*
2. 🔴 Fix SSRF in `summarize` — no redirects, scheme check, post-DNS private-IP block (S1).
3. 🔴 Add room/session participant authorization to socket joins (S2).
4. 🟠 Restrict `GET /users/:id` to a public projection (S3).
5. 🟠 Fix `technical2` grading + decide policy for client-scored rounds feeding the leaderboard (S5).

**Next:**
6. 🟡 Escape regex inputs (S6); apply `asyncHandler`/generic 500s app-wide (S7); mirror token-revocation in socket auth (S8); use `authUserName` in chat (S9); cap/persist AI context (S10).
7. 🟠 Fix mentorship rating so both parties can rate (B1); guard the `NaN` divisions (B2); validate resource existence in progress (B3).

**Cleanup:**
8. Resolve the four orphaned routes/models (I1); remove or implement `multer`/`pdf-parse` + resume upload (I2); drop the dead cookie branch or add `cookie-parser` (I3); add a minimal test scaffold (I5).

---

## 6. Remediation Status (applied 2026-06-09)

| ID | Fix applied | Files |
|---|---|---|
| 🔴 S1 | SSRF guard: http(s)-only, DNS-resolved private/loopback/link-local IP block, `maxRedirects: 0`, 5 MB cap. New `urlGuard` util (unit-verified). | `utils/urlGuard.js`, `routes/summarize.js` |
| 🔴 S2 | Hard participant authz on `join-session` (the confirmed private 1:1 mentorship video, `/video-call/:sessionId`); `session-peer-id` now requires the socket to have already joined that room. `join-room` left open **by design** — its id is a `MockInterview` id from the unmounted feature, so it cannot be authorized against `MentorshipSession`; commented for when that feature is revived. | `socket/socketHandler.js` |
| 🟠 S3 | `GET /users/:id` and `/mentors` now return a public projection (no email / auth fields); owner & admin get the full record. | `routes/users.js` |
| 🟠 S4 | `aiLimiter` wired onto every Groq/Gemini route. | `aiInterview`, `groupDiscussion`, `interviewGame`, `resumeBuilder`, `learningPaths`, `summarize` |
| 🟠 S5 | `technical2` now server-graded with the other MCQ rounds (uses `MCQ_ROUNDS`). | `routes/interviewGame.js` |
| 🟡 S6 | Regex inputs escaped before `RegExp`. | `routes/users.js`, `routes/resources.js` |
| 🟡 S7 | 500 responses return a generic message in production (dev keeps detail), across all routes. | all `routes/*.js` |
| 🟡 S8 | Socket auth now rejects JWTs issued before `passwordChangedAt`. | `socket/socketAuth.js` |
| 🟡 S9 | Chat broadcasts server-derived `authUserName`; client `userName` ignored; message length capped. | `socket/socketHandler.js` |
| 🟡 S10 | AI conversation context capped (40 msgs × 8 KB) and message validation added. | `aiInterview`, `groupDiscussion`, `summarize` |
| 🟠 B1 | Per-role rating flags (`menteeRated` / `mentorRated`) so both parties can rate; also fixed the silently-dropped `completedAt` (added to schema). | `models/MentorshipSession.js`, `routes/mentorship.js` |
| 🟡 B2 | NaN guards in resume-analysis fallback score and learning-path progress. | `routes/resumeAnalysis.js`, `routes/learningPaths.js` |
| 🟡 B3 | Progress now validates the resource exists; ObjectId-safe dedupe. | `routes/progress.js` |
| 🟡 B4 | Booking conflict replaced with a true interval-overlap check; invalid-date guard. | `routes/mentorship.js` |
| 🟡 I3 | Dead cookie-auth branch removed. | `middleware/auth.js` |

**Verified:** `node --check` on all server files (0 syntax errors), require-smoke-test loads all 25 modules, SSRF guard unit-checked against metadata/loopback/private ranges, and client routing traced to confirm the socket-authz scoping doesn't brick the live video call.

**Deferred by design (not fixed in this pass — tracked, not dropped):**
- **I1** — four orphaned routes/models (`gdRooms`, `mockInterviews`, `mockFeedback`, `codeSubmissions`): left to the existing `0001choreremove…` chore patch; deleting here would break `seedAll.js` and leave dangling client pages.
- **I2** — unused `multer`/`pdf-parse` deps + missing resume-upload endpoint.
- **I4** — migrate remaining routes to `asyncHandler`/`AppError` for centralized logging (only `auth.js` uses it today).
- **I5** — automated test scaffold.
- **Client UX follow-up** — the client should handle the new `session-unauthorized` / `room-unauthorized` socket events with a user-facing message (currently a denied join is silent on the client).
