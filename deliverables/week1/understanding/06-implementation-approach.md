# 06 — Planned Implementation Approach

This document explains **how** the project is being built: the guiding decision, the
engineering methodology, the phased roadmap, and how the team will work.

---

## 6.1 The guiding decision: harden, don't rewrite

After studying the codebase, the central decision was: **harden the existing
application in place rather than rewrite it.**

**Why.** The audit showed PRISM is *mostly feature-complete* — the routes, models, and
pages for every feature already exist. The failures are not "missing features" but
"unsafe and unreliable plumbing": security holes, missing access control, no input
validation, missing indexes, and a race condition. Rewriting would throw away working
code and add months of risk; the project is also going to be **maintained by students**,
which rules out exotic architectures. Hardening the proven React + Express + MongoDB
stack is faster, lower-risk, and leaves a codebase the next batch can understand.

---

## 6.2 Engineering methodology

The work follows a few non-negotiable practices:

1. **Security-first ordering.** Fix what makes the app *unsafe to expose* before
   anything cosmetic. A platform open to a whole college must not allow score forgery,
   unauthorized data access, or remote code execution.
2. **Small, verifiable increments.** Each change is self-contained and **tested**, not
   batched into one giant untestable change. Pure logic (e.g. the scoring grader) is
   written as standalone functions so it can be **unit-tested without a database**;
   security/data behaviour is **integration-tested against a real (Dockerized) MongoDB.**
3. **Evidence before claiming done.** Nothing is reported "fixed" without running the
   verification and seeing the output (syntax check, unit test, or integration test).
4. **Backward compatibility.** Changes preserve the existing API response shape
   (`{ success, ... }`) and existing client behaviour wherever possible, so the two
   packages stay in sync.
5. **Reuse over reinvention.** New code matches existing conventions; shared helpers
   (validation, error handling, pagination, ownership checks) are written once and
   adopted incrementally.

---

## 6.3 The phased roadmap

The work is organised into four phases, each a coherent unit.

### Phase 0 — Foundations *(done)*
The reliability/observability base everything else builds on:
- Boot-time **environment validation** (fail fast on misconfiguration).
- **Structured logging** + per-request **request IDs**.
- **Centralized error handling** (correct 4xx vs 5xx instead of "everything is 500").
- Reusable **request validation** and **rate-limiting** middleware.

### Phase 1 — Security-critical *(done)*
The set that makes the app safe to expose publicly:
- Server-authoritative **Interview-Game scoring** (no score forgery).
- **Code-execution sandbox** (no remote code execution).
- **Socket.IO authentication** (no unauthenticated realtime).
- **Role + ownership access control** (no accessing others' data).
- **Stored-XSS** fix (HTML-escaped emails).
- **Auth hardening** (strong passwords, lockout, password reset, token invalidation).
- **AI input caps** (cost/abuse control).

### Phase 2 — Correctness & scale *(in progress)*
Reliability under real load:
- **Database indexes** *(done)* + **TTL cleanup**.
- **Atomic slot booking** *(done)* — no double-booking.
- **Pagination** helper *(done; per-endpoint rollout pending)*.
- **Redis adapter** for multi-process realtime *(planned next)*.
- **Hardened AI JSON parsing** *(planned)*.
- Remaining **atomic multi-write** operations (rating, round submit) *(planned)*.

### Phase 3 — Feature completion & polish *(future)*
- Fix the few broken wires (e.g. a GD-rooms client/API mismatch).
- TURN-server-backed video for restrictive networks.
- Notification badge counts, session reschedule/cancel, admin edit screens.
- Toast notifications, error boundaries, socket-reconnection UX.

### Phase 4 — Production readiness *(future)*
- Database backups + restore runbook; migration scripts.
- Health probes, basic metrics/alerts.
- A test runner + automated tests for the five canonical workflows.
- Deployment + onboarding documentation for the next cohort.

---

## 6.4 Team plan (5 developers, ~1 month)

Phase 0 is built together (shared foundation), then the team parallelizes along
ownership lines that minimise file conflicts:

| Dev | Workstream |
|-----|-----------|
| A | Infra/DevOps & realtime (env config, Redis, Judge0/coturn, deployment) |
| B | Auth & access control (role/ownership guards, lockout, reset, rate limits) |
| C | Mentorship & resources core (booking, sessions, video, CRUD, progress) |
| D | Interview prep (AI/Game/résumé scoring, AI JSON validation, sandbox) |
| E | GD/admin/analytics + frontend polish (broken wires, admin, charts, UX) |

Cross-cutting rule: everyone writes validation + tests for their own area; database
index/migration changes are coordinated through Dev A to avoid conflicts.

---

## 6.5 Tooling & environment

- **Local database:** MongoDB runs in **Docker** (`docker compose up -d`) — one command,
  isolated, reproducible, no Atlas/network dependency. This is also what the automated
  tests run against.
- **Dev loop:** server uses `node --watch` (auto-restart); client uses Vite's hot
  module replacement.
- **Verification:** `node --check` for syntax, ad-hoc Node scripts for unit tests, and
  small Express apps mounted against the Docker MongoDB for integration tests.

---

## 6.6 Definition of done (per change)

A change is "done" only when:
1. It compiles (`node --check` / lint passes).
2. Its behaviour is demonstrated by a test (unit or integration) whose output was
   actually observed.
3. It preserves the existing API contract (or the client is updated in the same change).
4. It is committed with a message explaining *why*, not just *what*.

The proof that this methodology was followed is **Document 07**, which records each
Week-1 change together with the test output that verified it.
