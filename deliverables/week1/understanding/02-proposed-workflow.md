# 02 — Proposed Workflow & Access Model

This document answers **"who can do what, and in what sequence."** It has three parts:
the **role/access matrix** (the rules), the **canonical workflows** (the journeys),
and the **state machines** behind the two most important objects (a mentorship session
and an interview game).

---

## 2.1 The Access Model (capability × role)

PRISM has three roles: `mentee`, `mentor`, `admin`. Every protected action is checked
on **two layers**: the client hides UI the user shouldn't see, and — more importantly
— the **server independently re-checks** the user's role *and ownership of the specific
record* before acting. (The client check is convenience; the server check is security.
See Document 07, §7.5 for why "authenticated" is not the same as "authorized.")

| Capability | Mentee | Mentor | Admin |
|---|:--:|:--:|:--:|
| Browse topics / resources | ✅ | ✅ | ✅ |
| Upload resource | ❌ | ✅ | ✅ |
| Edit / delete a resource | ❌ | ✅ *(own only)* | ✅ *(any)* |
| Manage topics / companies | ❌ | create/edit | full CRUD |
| Set availability slots | ❌ | ✅ *(own)* | ❌ |
| Book a mentorship session | ✅ | ❌ | ❌ |
| Approve / reject a session | ❌ | ✅ *(as that mentor)* | ❌ |
| Join a session's video call | ✅ *(participant)* | ✅ *(participant)* | ❌ |
| Rate a completed session | ✅ *(mentee→mentor)* | ✅ *(mentor→mentee)* | ❌ |
| Host a mock interview / GD | ❌ | ✅ | ✅ |
| AI interview / Interview Game | ✅ | ✅ *(practice)* | ✅ |
| Build / analyze a résumé | ✅ | ✅ | ✅ |
| Run code in the sandbox | ✅ | ✅ | ✅ |
| View own progress / analytics | ✅ | ✅ | ✅ |
| View another user's private feedback | ❌ | ❌ *(only own mentees)* | ✅ |
| Admin panel (users, moderation) | ❌ | ❌ | ✅ |

**Reading the table:** "own only" means an ownership check (`record.uploadedBy ==
currentUser`) — not just a role check. This distinction is the single most common
class of access-control bug, and is exactly what was fixed in Week 1.

---

## 2.2 Canonical Workflows (the five journeys that must always work)

These five flows are the backbone of the product. They are written as numbered steps
so they can double as the basis for end-to-end tests.

### Workflow 1 — 1:1 Mentorship (the core loop)
1. **Mentor** publishes weekly availability and/or specific open slots.
2. **Mentee** browses mentors (filter by company/skill), opens a profile, sees open slots.
3. **Mentee** books a slot — the system **atomically** claims it (no two mentees can
   grab the same slot; see Document 07, §7.8) and creates a `pending` session.
4. **Mentor** is notified (in-app + email) and **approves or rejects**.
5. At the scheduled time, both **join a peer-to-peer video call** (WebRTC).
6. After the call, the session is marked **completed**.
7. **Both parties rate each other** (1–5). A mentee's rating updates the mentor's
   running average. Only the two participants may rate, and only once.

### Workflow 2 — 1:many Teaching (mock interview / group discussion)
1. **Mentor** creates a mock interview or GD (type: technical / HR / GD), optionally
   tagged to a company and topic.
2. **Mentees** join as participants.
3. The session runs live (shared coding room and/or video).
4. **Mentor** records **structured feedback** per participant (communication,
   technical, confidence, problem-solving scores + strengths/weaknesses/suggestions).
5. That feedback feeds the mentee's progress record and analytics.

### Workflow 3 — Solo Preparation (no human required)
A mentee can practise alone, any time, via:
- **AI Interview** — an LLM plays the interviewer, asks follow-ups, and finally returns
  a structured evaluation.
- **Interview Game** — a 6-round simulated placement drive: Aptitude → Technical 1 →
  Coding → Group Discussion → Technical 2 (live AI) → HR. Each round is scored; the
  MCQ rounds are **graded by the server** (Document 07, §7.2), the coding round runs
  in a **sandbox**, and the AI rounds are LLM-evaluated.
- **Résumé builder + ATS analysis** — build a structured résumé and score it against a
  real job description, getting missing-keyword and STAR-bullet suggestions.

### Workflow 4 — Resource & Learning Path
1. **Mentor** uploads a resource (video/article/PDF/link) under a **topic**, optionally
   tagged to a **company** and a **level** (beginner/intermediate/advanced).
2. **Mentee** browses/filters the library and marks resources complete.
3. Optionally, the mentee generates an **AI learning path**: the system feeds the
   topic's resources to an LLM, which orders them into a step-by-step study plan.
4. Completion updates the mentee's progress.

### Workflow 5 — Administration
1. **Admin** manages users (view, delete), curates topics and companies, and moderates
   resources.
2. **Admin** views platform-wide analytics and the Interview-Game leaderboard.

---

## 2.3 State Machine — Mentorship Session

A session is a small state machine. The legal transitions (and who may trigger them)
are enforced server-side:

```
            (mentee books)
                  │
                  ▼
              ┌────────┐   mentor rejects   ┌──────────┐
              │ pending│ ──────────────────▶│ rejected │ (terminal)
              └────────┘                    └──────────┘
                  │ mentor approves
                  ▼
              ┌─────────┐   either cancels   ┌───────────┐
              │ approved│ ──────────────────▶│ cancelled │ (terminal)
              └─────────┘                    └───────────┘
                  │ session starts
                  ▼
            ┌─────────────┐
            │ in-progress │
            └─────────────┘
                  │ session ends
                  ▼
             ┌──────────┐   then: each party may rate once
             │ completed│ ──────────────────────────────────▶ (ratings recorded)
             └──────────┘
```

**Authorization rules baked into the transitions:**
- Only the **mentor** of the session may move `pending → approved/rejected`.
- Either **participant** may `cancel`.
- Only a session's **two participants** may rate it, and only after `completed`, and
  only once (`ratingGiven` guards against double-rating).

## 2.4 State Machine — Interview Game

```
 (mentee starts)            per round: serve → play → submit (server scores)
       │                    ┌─────────────────────────────────────────────┐
       ▼                    ▼                                             │
  ┌────────────┐   round 0..5   ┌───────────┐  pass   ┌──────────────┐    │
  │ in-progress│ ─────────────▶ │  playing  │ ──────▶ │ round result │ ───┘
  └────────────┘                └───────────┘         └──────────────┘
       │                              │ fail (full-game mode)
       │ last round done              ▼
       ▼                        ┌──────────┐
  ┌──────────┐                  │  failed  │ (eliminated; study suggestions shown)
  │ completed│                  └──────────┘
  └──────────┘
       │
       ▼
  totalScore computed; leaderboard updated
```

The crucial security property: **the score is assigned by the server, not the
browser.** For MCQ rounds the server stores the answer key when it serves the
questions and grades the submission against it — the browser never receives the
answers. (Full internals in Document 07, §7.2.)

## 2.5 Why this workflow design

- **Two-sided value:** mentors produce (availability, content, feedback); mentees
  consume and practise. The platform is only useful if both sides have a frictionless
  loop — hence booking, notifications, and ratings close the mentor↔mentee loop, while
  solo AI practice gives mentees value even when no mentor is online.
- **Trust by role:** content is created by mentors/admins, not arbitrary users, which
  is what makes the resource and question libraries trustworthy.
- **Security by ownership:** every action is gated not just by *role* but by
  *ownership of the specific record*, which is what makes it safe to open to a whole
  college.
