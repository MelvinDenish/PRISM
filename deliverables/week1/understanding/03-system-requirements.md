# 03 — System Requirements

This document specifies **what the system must do** (functional requirements), **how
well it must do it** (non-functional requirements), and **what it is built from and
runs on** (technology stack, environment, and hardware).

---

## 3.1 Functional Requirements

Grouped by feature area. "The system shall…" phrasing is used so each line is testable.

### FR-A Authentication & Accounts
- FR-A1 The system shall let a user **register** as a mentor or mentee with name,
  email, password, and role.
- FR-A2 The system shall **reject weak passwords** (minimum 8 characters, at least one
  letter and one number).
- FR-A3 The system shall let a user **log in** and receive a signed session token (JWT).
- FR-A4 The system shall **lock an account** after 5 consecutive failed logins for 15 minutes.
- FR-A5 The system shall support **password reset** via a time-limited emailed link.
- FR-A6 The system shall let a user **view and edit their own profile** only.

### FR-B Mentorship
- FR-B1 A mentor shall **publish availability** (weekly recurring + specific slots).
- FR-B2 A mentee shall **book** an open slot; the system shall prevent double-booking.
- FR-B3 A mentor shall **approve/reject** their pending sessions.
- FR-B4 Both participants shall **join a video call** for an approved session.
- FR-B5 Participants shall **rate** a completed session once; mentee ratings shall
  update the mentor's average rating.

### FR-C Interview Practice
- FR-C1 A user shall take an **AI interview** that asks questions and returns an evaluation.
- FR-C2 A user shall play the **6-round Interview Game**; the system shall **score it server-side**.
- FR-C3 The system shall serve MCQ questions **without revealing the correct answers** to the client.
- FR-C4 A user shall run code in **5 languages** (JS, Python, C++, Java, C) against test cases in a **sandbox**.
- FR-C5 A user shall take part in an **AI-moderated or multi-user group discussion**.

### FR-D Résumé
- FR-D1 A user shall build a **structured résumé** (personal, education, experience, skills, projects).
- FR-D2 The system shall **AI-generate** résumé content and cover letters.
- FR-D3 The system shall **score a résumé against a job description** (ATS match, missing keywords, suggestions).

### FR-E Resources & Learning
- FR-E1 A mentor shall **upload resources** tagged by topic, company, and level.
- FR-E2 A user shall **browse/filter** resources and **mark them complete**.
- FR-E3 The system shall **generate an AI learning path** ordering a topic's resources.

### FR-F Progress, Analytics, Notifications, Admin
- FR-F1 The system shall **track each mentee's progress** (completed resources, interview scores).
- FR-F2 The system shall show **analytics dashboards** and an Interview-Game **leaderboard**.
- FR-F3 The system shall send **in-app and email notifications** for key events.
- FR-F4 An admin shall **manage users, topics, companies**, and moderate content.

---

## 3.2 Non-Functional Requirements (NFRs)

These are what turn a demo into a product. Each maps to specific Week 1 work.

| ID | Requirement | Target | How it is met |
|----|-------------|--------|---------------|
| NFR-Security-1 | Authentication on every protected endpoint | 100% | JWT `protect` middleware |
| NFR-Security-2 | Authorization by role **and record ownership** | 100% | `authorize()` + `isOwner()` checks |
| NFR-Security-3 | No exam-score tampering | Server-authoritative | Server stores answer key; grades server-side |
| NFR-Security-4 | Code execution cannot harm the host | Sandboxed | Judge0 only in production; no local fallback |
| NFR-Security-5 | Realtime events authenticated | 100% | JWT handshake on Socket.IO |
| NFR-Security-6 | Secrets never committed / leaked | Enforced | `.env` gitignored; boot-time validation |
| NFR-Reliability-1 | Server fails fast on misconfiguration | At boot | Env validation refuses to start if invalid |
| NFR-Reliability-2 | Errors are categorized (4xx vs 5xx), not all 500 | 100% | Central error handler |
| NFR-Reliability-3 | Every request is traceable | Request ID | `requestContext` middleware + structured logs |
| NFR-Performance-1 | Hot queries use indexes | No collection scans | Indexes on 7 collections |
| NFR-Performance-2 | List endpoints are bounded | Paginated | `getPagination` helper (rollout in progress) |
| NFR-Integrity-1 | No double-booking under concurrency | Atomic | `findOneAndUpdate` conditional write |
| NFR-Abuse-1 | Endpoints resist brute force / cost abuse | Rate-limited | Tiered rate limiters (auth/AI/code-exec) |
| NFR-Scale-1 | Can run multiple server processes | Designed for | Stateless HTTP; realtime state → Redis (planned) |
| NFR-Maintainability-1 | A student can run & extend it | Documented | `.env.example`, docker-compose, these docs |

---

## 3.3 Technology Stack (exact, from `package.json`)

### Client (`client/`) — a Single-Page Application
| Package | Version | Role |
|---------|---------|------|
| `react`, `react-dom` | 19.2 | UI library (component model, virtual DOM) |
| `vite` | 7.3 | Build tool + dev server (fast HMR via native ES modules) |
| `react-router-dom` | 7.13 | Client-side routing |
| `axios` | 1.13 | HTTP client (with an interceptor that attaches the JWT) |
| `socket.io-client` | 4.8 | Realtime channel to the server |
| `peerjs` | 1.5 | WebRTC peer-to-peer video/audio |
| `@monaco-editor/react` | 4.7 | The VS Code editor, embedded for the coding rounds |
| `recharts` | 3.8 | Analytics charts |
| `framer-motion` | 12 | Animations |
| `docx`, `file-saver`, `html2pdf.js` | — | Export résumé to DOCX/PDF |
| `eslint` (+ plugins) | 9 | Linting (dev) |

### Server (`server/`) — a REST + WebSocket API
| Package | Version | Role |
|---------|---------|------|
| `express` | 4.21 | HTTP web framework |
| `socket.io` | 4.7 | WebSocket server (realtime rooms, signaling) |
| `mongoose` | 8.6 | MongoDB ODM (schemas, validation, queries) |
| `jsonwebtoken` | 9.0 | Sign/verify JWT session tokens |
| `bcryptjs` | 2.4 | Password hashing (salted) |
| `express-rate-limit` | 7.4 | Rate limiting |
| `groq-sdk` | 1.1 | LLM client for AI features (Llama 3.1) |
| `nodemailer` | 8.0 | Transactional email (Gmail SMTP) |
| `multer` | 1.4 | File uploads |
| `pdf-parse` | 1.1 | Extract text from uploaded résumé PDFs |
| `cors`, `dotenv`, `axios` | — | CORS, env loading, outbound HTTP |

### External services
- **MongoDB** — primary database (self-hosted via Docker locally; Atlas or self-hosted in prod).
- **Groq / Google Gemini** — LLM inference for all AI features.
- **Judge0** — sandboxed code-execution engine.
- **PeerJS broker + STUN/TURN** — WebRTC signaling & NAT traversal for video.
- **Redis** *(planned, Phase 2)* — shared state for multi-process realtime.

---

## 3.4 Environment Configuration

The server validates all of this at boot and refuses to start if a **required**
variable is missing (see Document 07, §7.1). Template lives in `server/.env.example`.

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `MONGODB_URI` | **Required** | Database connection string |
| `JWT_SECRET` | **Required** (≥16 chars) | Secret used to sign/verify session tokens |
| `JWT_EXPIRE` | default `7d` | Token lifetime |
| `PORT` | default `5000` | Server port |
| `NODE_ENV` | default `development` | Toggles prod-only safety (e.g. no local code exec) |
| `CLIENT_URL` | default `localhost:5173` | Allowed CORS / Socket.IO origins |
| `JUDGE0_API_URL` | default `localhost:2358` | Code-execution engine endpoint |
| `GROQ_API_KEY` | feature-gated | Enables AI features; absent → those features disabled |
| `GEMINI_API_KEY` | feature-gated | Enables résumé ATS analysis |
| `EMAIL_USER` / `EMAIL_PASS` | feature-gated | Enables email notifications |
| `LOG_LEVEL` | default `info` | Logging verbosity |

**"Feature-gated"** means: if the key is absent, the server still boots and logs a
warning, and only that one feature is disabled. This is a deliberate design choice so
that, e.g., a missing email password never takes down login.

---

## 3.5 Hardware / Deployment Requirements

| Environment | Minimum |
|-------------|---------|
| **Developer machine** | Node.js 18+ (uses `node --watch`), Docker Desktop (for MongoDB), 8 GB RAM |
| **Production server (institution-hosted)** | A Linux VM with ~2 vCPU / 4 GB RAM for the app + MongoDB; additional containers for Redis, Judge0, and a coturn TURN server; nginx as a TLS-terminating reverse proxy; PM2 to keep the Node process alive |
| **Client** | Any modern browser (Chrome/Edge/Firefox); WebRTC support for video |

The whole production stack is intended to run via Docker on a single college-provided
VM — no cloud account or external managed services are required.
