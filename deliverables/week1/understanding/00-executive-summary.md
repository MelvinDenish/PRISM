# 00 — Executive Summary

> One page. For the full detail behind each line here, follow the linked documents.

## What PRISM is

**PRISM (Placement Resources & Interview Skill Manager)** is a web platform that
connects **mentors** (seniors / placed students / faculty) with **mentees** (juniors
preparing for campus placements). It brings the entire placement-preparation journey
into one place: booking 1:1 mentorship, attending mock interviews, practising with an
AI interviewer, building an ATS-friendly résumé, solving coding problems in a
sandbox, taking part in group discussions, and studying from a curated, topic-wise
resource library — with progress analytics on top.

## The problem it solves

Today, placement preparation is scattered across WhatsApp groups, random PDFs,
unstructured senior-junior favours, and a dozen separate websites. There is no single
record of *who is preparing for what*, *which resources are trustworthy*, or *whether
a student is actually improving*. PRISM consolidates this into one auditable system
owned by the department.

## Who uses it (roles)

- **Mentee** — books sessions, practises interviews, builds résumés, studies resources, tracks progress.
- **Mentor** — sets availability, teaches 1:1 or 1:many, uploads resources, gives structured feedback.
- **Admin** — manages users/content, moderates, views platform-wide analytics.

## Technology stack

| Layer | Technology |
|-------|-----------|
| Client | React 19, Vite 7, React Router 7, Socket.IO-client, PeerJS, Recharts, Monaco editor |
| Server | Node.js, Express 4, Socket.IO 4, Mongoose 8, JWT, bcryptjs |
| Database | MongoDB (document database) |
| AI | Groq (Llama 3.1) + Google Gemini |
| Code execution | Judge0 (sandboxed) |
| Realtime video | WebRTC via PeerJS |
| Infra (local) | Docker (MongoDB) |

## Week 1 status

| Deliverable | Status |
|-------------|--------|
| Understand project requirements & objectives | ✅ Document 01 |
| Study existing implementation | ✅ Read full codebase (2 packages, 18 data models, ~20 API route groups) |
| Finalize workflow & system requirements | ✅ Documents 02, 03 |
| Design database schema & architecture | ✅ Documents 04, 05 |
| Plan implementation approach | ✅ Document 06 |
| Presentation | ✅ Document 08 |
| **(Bonus) Begin implementation** | ✅ Foundations + all security-critical fixes + indexing/atomicity, **tested against Docker MongoDB** — Document 07 |

## Key finding from studying the code

The existing project is **mostly feature-complete but not production-safe**. The work
was therefore not "build missing features" but "**make what exists trustworthy**":
close security holes (exam-score forgery, unauthenticated realtime, unsandboxed code
execution, broken access control), add a reliability/observability foundation, and
fix data-integrity issues (missing indexes, a double-booking race). All of this is
explained, with reasoning and internals, in **Document 07**.
