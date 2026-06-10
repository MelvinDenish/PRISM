# 01 — Project Understanding

## 1.1 Context

Campus placements are the single most important outcome of an undergraduate
engineering program. Yet the preparation for them is almost entirely informal:
juniors chase seniors for guidance over WhatsApp, share unverified PDFs, and practise
interviews in an ad-hoc way with no record of progress. The department has no
visibility into who is preparing, how well, or where the gaps are.

**PRISM (Placement Resources & Interview Skill Manager)** is an internally-owned web
platform that formalizes this entire journey. It is being developed during this
internship so that it can be handed to the next batch of students and used by the
whole college.

## 1.2 Problem Statement

> Placement preparation is **fragmented, unverified, and unmeasured.**

Concretely, three problems:

1. **Fragmentation** — mentorship, mock interviews, résumé help, coding practice,
   group discussions, and study material live in separate, disconnected tools.
2. **Lack of trust/verification** — there is no curated, mentor-vetted source of
   resources or questions; anyone can share anything.
3. **No measurement** — neither the student nor the department can see whether
   preparation is actually improving interview readiness.

PRISM solves all three by being a **single, role-based, auditable platform** where
mentors produce trusted content and feedback, mentees consume it and practise, and the
system records measurable progress.

## 1.3 Objectives

| # | Objective | How PRISM meets it |
|---|-----------|--------------------|
| O1 | Connect mentees with mentors for structured guidance | Availability + booking + 1:1 video sessions + ratings |
| O2 | Let mentors teach one or many mentees | Mentorship sessions (1:1) and mock interviews / GD rooms (1:many) |
| O3 | Provide realistic interview practice without a human always present | AI interviewer, 6-round "Interview Game", AI-moderated group discussion |
| O4 | Help students produce strong, ATS-friendly résumés | Résumé builder + AI résumé/ATS analysis against a job description |
| O5 | Provide a trusted, topic-wise resource library | Mentor-uploaded resources tagged by topic, company, and level |
| O6 | Let students practise coding in a safe environment | In-browser code editor + sandboxed multi-language execution and test cases |
| O7 | Make progress visible | Per-mentee progress tracking and analytics dashboards |
| O8 | Be safe and reliable enough for real, college-wide use | Production hardening: auth, access control, data integrity (the Week 1 engineering work) |

## 1.4 Users and Personas

PRISM has exactly **three roles**, enforced everywhere in the system (`mentee`,
`mentor`, `admin`).

### Persona A — "Arjun", the Mentee (3rd-year student)
- **Goal:** Get placed. Needs guidance, practice, and feedback.
- **Uses PRISM to:** book sessions with seniors, take AI mock interviews and the
  Interview Game, build/analyze his résumé, solve coding problems, study resources,
  and see where he stands.

### Persona B — "Priya", the Mentor (final-year / placed student / faculty)
- **Goal:** Help juniors efficiently, without repeating herself.
- **Uses PRISM to:** publish her weekly availability, run 1:1 sessions and group mock
  interviews, upload the resources she trusts, and leave structured feedback that
  feeds a mentee's progress record.

### Persona C — "Dr. Rao", the Admin (placement coordinator / faculty)
- **Goal:** Keep the platform healthy and see the big picture.
- **Uses PRISM to:** manage users, curate topics/companies, moderate content, and view
  platform-wide analytics and leaderboards.

## 1.5 Feature Catalogue (as it exists in the codebase)

Studying the code, PRISM is organised into these feature areas. Each maps to a set of
server routes (`server/routes/*`) and client pages (`client/src/pages/*`).

| Feature | Description | Server route group | Client page |
|---------|-------------|---------------------|-------------|
| Authentication | Register/login/profile, JWT-based | `auth`, `users` | `Login`, `Register` |
| Mentor discovery & profiles | Browse/filter mentors, view profile | `users` | `Mentors`, `MentorProfile` |
| Availability & booking | Mentor sets slots; mentee books | `availability`, `mentorship` | `MentorProfile`, `Sessions` |
| Mentorship sessions | 1:1 session lifecycle + video + rating | `mentorship` | `Sessions`, `VideoCall` |
| Mock interviews | Mentor-hosted 1:many practice + feedback | `mockInterviews`, `mockFeedback` | `TechnicalInterview` |
| AI interview | LLM acts as interviewer, then evaluates | `ai-interview` | `TechnicalInterview`, `InterviewGame` |
| Interview Game | 6-round simulated placement drive | `interview-game` | `InterviewGame` |
| Group discussion | AI-moderated / multi-user GD | `group-discussion` | `GDRooms`, `InterviewGame` |
| Coding practice | Editor + sandboxed run + test cases | `code-execution`, `coding-questions` | `CodingQuestions`, `InterviewGame` |
| Résumé builder | Structured résumé + AI content generation | `resume-builder` | `ResumeBuilder` |
| Résumé/ATS analysis | Score résumé vs a job description | `resume-analysis` | `ResumeAnalysis` |
| Resource library | Mentor-uploaded study material | `resources`, `topics`, `companies` | `Resources`, `Topics`, `Companies` |
| Learning paths | AI-ordered study path from resources | `learning-paths` | `LearningPaths` |
| Progress & analytics | Track completion & interview scores | `progress`, `analytics` | `Analytics`, `Dashboard` |
| Notifications | In-app + email events | `notifications` | `Notifications` |
| Admin | User/content management | (role-gated routes) | `Admin` |

## 1.6 Scope

### In scope (this project)
- All features above, made **production-usable**: secured, access-controlled,
  reliable, and documented well enough for the next student cohort to maintain.
- Self-hosting on department infrastructure.

### Out of scope (explicitly, for now)
- Mobile native apps (the web app is responsive and sufficient).
- Integration with external placement portals / company ATS systems.
- Payment/monetisation (the platform is free and internal).
- Massive multi-college scale on day one — the architecture allows for it, but the
  initial target is one college at placement-season peak (a few hundred concurrent
  users), not millions.

## 1.7 Key constraints and assumptions

- **Maintainership:** the code will be handed to **students**, so the architecture
  must stay simple (a two-package React + Express + MongoDB monorepo) rather than
  exotic (microservices, Kubernetes, message queues).
- **Hosting:** institution-hosted — the college provides a server/VM, so we can
  self-host every dependency (MongoDB, Redis, Judge0, a TURN server) behind the
  college network.
- **AI keys:** AI features depend on third-party LLM API keys (Groq/Gemini); the
  system is designed so that if a key is absent, only that feature is disabled — the
  rest of the platform still runs.

## 1.8 Success criteria for the project

PRISM is "done" for the department when:
1. A student of any role can complete their core journey end-to-end without errors.
2. The platform is **safe to expose** to the whole college (no score forgery, no
   unauthorized data access, no remote-code-execution risk).
3. It **survives load** at placement season (indexed queries, no race conditions).
4. The next batch can **run, understand, and extend** it from the documentation.

The Week 1 work (Document 07) directly attacks criteria 2 and 3.
