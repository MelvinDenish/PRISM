---
marp: true
title: PRISM — Week 1 Review
author: L. Melvin Denish (CSE, 3rd Year)
paginate: true
theme: default
---

<!--
This is a Marp slide deck. To present:
  • VS Code: install the "Marp for VS Code" extension and open the preview.
  • CLI: `npx @marp-team/marp-cli 08-presentation.md --pdf` (or --pptx, --html)
Each "---" starts a new slide.
-->

# PRISM
### Placement Resources & Interview Skill Manager
**Week 1 Internship Review**

L. Melvin Denish · CSE, 3rd Year · June 2026

---

## Agenda

1. Understanding the project
2. The problem & objectives
3. Users & proposed workflow
4. System requirements
5. Database design
6. System architecture
7. Implementation approach
8. Work completed (with proof)
9. What's next

---

## 1 · What is PRISM?

A **single platform** for the whole campus-placement preparation journey:

- 🤝 Mentorship (1:1 sessions with seniors)
- 🎤 Mock interviews & AI interview practice
- 🎮 A 6-round "Interview Game"
- 📄 ATS-friendly résumé builder & analysis
- 💻 Sandboxed coding practice
- 🗣️ Group discussions
- 📚 A curated, mentor-verified resource library
- 📊 Progress analytics

> Built to be **owned by the department** and handed to the next student batch.

---

## 2 · The Problem

Placement prep today is:

| Problem | Consequence |
|---------|-------------|
| **Fragmented** | Scattered across WhatsApp, PDFs, many sites |
| **Unverified** | No trusted source of resources/questions |
| **Unmeasured** | Nobody can see if a student is improving |

**PRISM** = one role-based, auditable platform that fixes all three.

---

## 2 · Objectives

- Connect mentees with mentors (book → meet → feedback → rate)
- Enable 1:1 **and** 1:many teaching
- Provide realistic practice **without a human always present** (AI)
- Help students build strong, ATS-ready résumés
- Offer a trusted resource library + AI learning paths
- Make progress **visible**
- **Be safe & reliable enough for real, college-wide use** ← Week 1 focus

---

## 3 · Users (3 roles)

| Role | Uses PRISM to… |
|------|----------------|
| **Mentee** | Book sessions, practise interviews, build résumés, study, track progress |
| **Mentor** | Set availability, teach, upload resources, give structured feedback |
| **Admin** | Manage users/content, moderate, view platform analytics |

Roles are enforced **on the server**, on every action.

---

## 3 · Proposed Workflow (core loop)

```
Mentor sets availability
        │
Mentee browses → books a slot  (atomic: no double-booking)
        │
Mentor approves / rejects  → notified
        │
Both join video call (peer-to-peer)
        │
Session completed → both rate (mentee rating updates mentor average)
```

Plus solo practice (AI interview, Interview Game, résumé tools) anytime.

---

## 3 · Access Model — role **and** ownership

|  | Mentee | Mentor | Admin |
|--|:--:|:--:|:--:|
| Browse resources | ✅ | ✅ | ✅ |
| Edit/delete a resource | ❌ | ✅ *(own)* | ✅ *(any)* |
| Book a session | ✅ | ❌ | ❌ |
| Approve a session | ❌ | ✅ | ❌ |
| Admin panel | ❌ | ❌ | ✅ |

> "own" = an **ownership check**, not just a role check — the key security idea.

---

## 4 · System Requirements

**Functional:** auth, mentorship, interview practice, résumé, resources, analytics, admin.

**Non-functional (what makes it production-grade):**
- 🔒 Auth + role/ownership on every endpoint
- 🛡️ No score forgery · sandboxed code · authenticated realtime
- ⚙️ Fail-fast config · structured errors · request tracing
- ⚡ Indexed queries · pagination · atomic writes
- 🚦 Rate limiting · secrets never leaked

---

## 4 · Technology Stack

| Layer | Tech |
|-------|------|
| Client | **React 19**, Vite 7, React Router 7, Socket.IO-client, PeerJS, Monaco, Recharts |
| Server | **Node.js**, Express 4, Socket.IO 4, **Mongoose 8**, JWT, bcrypt |
| Database | **MongoDB** |
| AI | Groq (Llama 3.1) + Gemini |
| Code exec | **Judge0** (sandbox) |
| Video | WebRTC (PeerJS) |
| Infra | **Docker** (Mongo), nginx, PM2, Redis* |

<small>*planned</small>

---

## 5 · Database Design — principles

- **MongoDB** (document DB) via **Mongoose** (schema + validation)
- **Embed** data owned by its parent (game rounds, résumé sections, slots)
- **Reference** shared entities (User, Topic, Company, Resource)
- **Index** only the fields real queries filter/sort on → O(log n), not O(n)
- **TTL index** auto-purges old notifications
- **Atomic single-document writes** for integrity (booking)

18 collections, centered on **User**.

---

## 5 · Database — the entity map

```
        MentorshipSession ─┐        ┌─ InterviewGame (embeds rounds)
        Availability ──────┤        ├─ ResumeDraft / ResumeAnalysis
        MockInterview ─────┼─ User ─┤─ LearningPath (embeds steps)
        MockFeedback ──────┤        ├─ Progress / Notification
        Resource ──────────┘        └─ CodeSubmission
              │                            │
          Topic / Company  ◀── tagging ──── QuestionBank / CodingQuestion
```

Security-shaped fields: hashed passwords, hashed reset tokens, and an answer key
(`servedQuestions`) that is **never sent to the client**.

---

## 6 · System Architecture

```
Browser (React SPA)  ──HTTPS REST──▶  Express  ─▶ Mongoose ─▶ MongoDB
        │            ──WebSocket───▶  Socket.IO
        └────────── peer-to-peer video (WebRTC) ──────────┘
```

**Layered server:** middleware → routing → auth/validate → handler → model → error handler.

**Stateless JWT auth** → horizontally scalable.

**Isolated sub-systems:** AI (Groq/Gemini), code exec (Judge0 sandbox), video (WebRTC).

---

## 6 · Request lifecycle (booking a slot)

1. axios attaches JWT → `PATCH /api/availability/book/0`
2. cors → body parse → **request-id** → **rate limit**
3. **`protect`** verifies JWT + token freshness
4. Handler runs an **atomic conditional update**
5. MongoDB executes it atomically → returns slot or `null`
6. `200` booked / `409` already taken
7. Any error → **central handler** maps it to the right status

---

## 7 · Implementation Approach

**Decision: harden in place, don't rewrite.**
The app is feature-complete but not *safe*. Rewriting wastes working code and risks the
student handoff.

**Methodology:** security-first · small verifiable increments · **evidence before
"done"** · backward-compatible · reuse shared helpers.

**Phases:** 0 Foundations → 1 Security → 2 Scale → 3 Polish → 4 Production.

---

## 8 · Work Completed — Phase 0 & 1

**Phase 0 (foundations):** env validation, structured logging + request IDs, central
error handling, reusable validation + rate limiting.

**Phase 1 (security-critical):**
- 🎯 Server-authoritative Interview-Game scoring (no forgery)
- 🧪 Code-exec sandbox (no RCE in production)
- 🔌 Socket.IO JWT authentication
- 🔑 Role + ownership access control (fixed IDORs)
- 🧱 Stored-XSS fix in emails
- 🛡️ Auth hardening: strong passwords, lockout, reset, token invalidation

---

## 8 · Work Completed — Phase 2 (started)

- 🗂️ **Indexes** on 7 hot collections (+ 90-day TTL on notifications)
- 🔒 **Atomic slot booking** — double-book race eliminated
- 📄 **Pagination** helper (rollout in progress)
- 🐳 **MongoDB in Docker** for local dev & testing

---

## 8 · Proof — everything was tested

Tested against a **real (Dockerized) MongoDB**, output observed:

| Area | Result |
|------|--------|
| Auth (password policy, lockout, reset, token invalidation) | **9 / 9** |
| Access control (ownership / IDOR) | **6 / 6** |
| Booking under concurrency | one `200`, one `409` ✅ |
| Index builds | all created ✅ |
| Scoring + answer-key sanitizer | all assertions ✅ |

> Nothing claimed "done" without seeing the test pass.

---

## 9 · What's Next

- **Phase 2 remaining:** Redis for multi-process realtime · hardened AI JSON parsing ·
  pagination rollout · remaining atomic writes
- **Phase 3:** TURN-backed video · fix broken wires · UX polish
- **Phase 4:** backups · health/metrics · automated test suite · deployment docs

Target: a platform **safe and reliable enough for the whole college**, maintainable by
the next batch.

---

## Thank you

**PRISM — Placement Resources & Interview Skill Manager**

Understanding ✅ · Workflow ✅ · Requirements ✅ · Database ✅ · Architecture ✅ ·
Approach ✅ · **+ secured & tested foundations**

*Questions?*
