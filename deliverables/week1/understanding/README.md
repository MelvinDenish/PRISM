# PRISM — Week 1 Deliverables

**Project:** PRISM — Placement Resources & Interview Skill Manager
**Intern:** L. Melvin Denish (CSE, 3rd Year)
**Review Period:** Week 1
**Date:** June 2026

---

## Purpose of this folder

This folder contains the Week 1 deliverables for the PRISM internship project. The
goal of Week 1 was to **understand the existing project, define what it should
become, design its data and architecture, and begin hardening it toward a
production-usable state** for the department.

These documents are written to be read top-to-bottom, but each is self-contained.

## How to read these documents

| # | File | What it answers |
|---|------|-----------------|
| 00 | [00-executive-summary.md](00-executive-summary.md) | The one-page version of everything below |
| 01 | [01-project-understanding.md](01-project-understanding.md) | What PRISM is, the problem it solves, objectives, users, and scope |
| 02 | [02-proposed-workflow.md](02-proposed-workflow.md) | Who uses it for what — role-by-role workflows and the access model |
| 03 | [03-system-requirements.md](03-system-requirements.md) | Functional + non-functional requirements, full technology stack, environment |
| 04 | [04-database-design.md](04-database-design.md) | Every collection, every field, relationships, indexes, and *why* each exists |
| 05 | [05-system-architecture.md](05-system-architecture.md) | How the system is structured: layers, request lifecycle, realtime, AI, deployment |
| 06 | [06-implementation-approach.md](06-implementation-approach.md) | The phased plan and engineering methodology for building it |
| 07 | [07-work-completed-deep-dive.md](07-work-completed-deep-dive.md) | **Line-by-line, why-and-how** explanation of the work actually completed in Week 1 |
| 08 | [08-presentation.md](08-presentation.md) | The review presentation (slide-by-slide) |

## A note on technical depth

Document **07** is the deepest. The brief for Week 1 explicitly asked not just for an
outline but for *"a complete step-by-step, process-by-process, line-by-line
explanation of why something is done and how it works internally."* So document 07
explains each change not as "what was added" but as **why the problem existed, how
the fix works at the level of the language/runtime/database, and what would break
without it.**

## Project at a glance

- **What:** A web platform where seniors/mentors coach juniors/mentees for campus
  placements — mentorship sessions, mock interviews, AI interview practice, an ATS
  résumé builder, a coding sandbox, group discussions, and a curated resource library.
- **Stack:** React 19 + Vite (client) · Node.js + Express 4 + Socket.IO (server) ·
  MongoDB + Mongoose (database) · Groq/Gemini LLMs (AI features) · Judge0 (code
  execution) · PeerJS/WebRTC (video).
- **Week 1 outcome:** Project understood end-to-end; workflow, requirements,
  database, and architecture documented; and the foundational + security-critical
  hardening (Phases 0–1) plus part of the scalability work (Phase 2) implemented and
  tested against a Dockerized MongoDB.
