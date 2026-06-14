# PRISM

**Placement Resources & Interview Skill Manager** — a mentor/mentee platform that helps students prepare for campus placements end-to-end: structured learning paths, resume building & ATS analysis, AI mock interviews, an interview MCQ game, behavioral practice, group discussions, live 1:1 mentorship video, and progress tracking.

PRISM is a two-package monorepo: a **React + Vite** client and an **Express + MongoDB** server, wired together with **Socket.IO** (presence, coding rooms, signaling) and **LiveKit** (live video). AI features are powered by Groq (and optional OpenAI-compatible providers).

> Status: active development. The repo root has no workspace tooling — `client/` and `server/` are installed and run independently.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Seeding data](#seeding-data)
- [Architecture](#architecture)
- [API surface](#api-surface)
- [Optional services](#optional-services)
- [Further documentation](#further-documentation)
- [Conventions](#conventions)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
|------|--------------|
| **Auth & roles** | JWT auth with three roles: `mentor`, `mentee`, `admin`. Role-gated routes throughout. |
| **Mentorship** | Mentor discovery, availability scheduling, 1:1 sessions, and live video calls (LiveKit). |
| **Learning paths** | Curated/AI-generated study tracks with resources, tests, and completion certificates. |
| **Resume builder** | Conversational intake agent, CUIC-aligned templates, live canvas editing, and PDF export. |
| **Resume / ATS analysis** | Keyword and (optional Gemini-powered) ATS scoring against a job description. |
| **AI mock interview** | Groq-backed Q&A interview with feedback. |
| **Interview Game** | MCQ quiz drawing from a curated bank, mentor uploads, and (optional Tavily) company-specific researched questions. |
| **Technical interview** | Shared coding room (Monaco editor + Socket.IO) with sandboxed execution (Judge0 or local fallback). |
| **Behavioral practice** | STAR-method practice with skill-signal scoring and a review queue. |
| **Group discussion** | Timed GD rooms with live video and moderation prompts. |
| **Webinars** | 1-to-many live sessions over LiveKit. |
| **PRISM Copilot** | An agentic, tool-calling chat assistant (provider-agnostic, OpenAI-compatible). |
| **Progress & analytics** | Per-mentee progress tracking, eligibility/company matching, and dashboards. |
| **Notifications** | In-app notifications plus optional email (Gmail SMTP). |

---

## Tech stack

**Client** — React 19, Vite 7, React Router 7, Framer Motion, Recharts, Monaco Editor, LiveKit components, Socket.IO client. Plain CSS (no Tailwind / CSS-in-JS).

**Server** — Node.js + Express 4, MongoDB via Mongoose 8, Socket.IO, LiveKit Server SDK, JWT (`jsonwebtoken` + `bcryptjs`), Groq SDK, Puppeteer / PDFKit / `docx` for document generation, Multer for uploads, `@aws-sdk/client-s3` for optional S3 storage.

---

## Repository layout

```
PRISM/
├── client/                 # React + Vite single-page app
│   ├── src/
│   │   ├── pages/          # Route-level pages (Dashboard, ResumeBuilder, InterviewGame, …)
│   │   ├── components/     # Shared UI (Sidebar, ProtectedRoute, …)
│   │   ├── context/        # AuthContext (JWT + presence socket)
│   │   ├── services/api.js # Single axios layer — all HTTP goes through here
│   │   └── App.jsx         # Route table
│   └── .env.example
├── server/                 # Express + MongoDB API
│   ├── server.js           # App entry: connects DB, mounts routes, starts Socket.IO
│   ├── routes/             # One router per feature (mounted under /api/<feature>)
│   ├── models/             # Mongoose schemas
│   ├── middleware/auth.js  # protect + authorize(...roles)
│   ├── socket/             # Socket.IO handler (rooms, presence, signaling)
│   ├── agent/              # PRISM Copilot + LLM services
│   ├── utils/storage/      # Pluggable file storage (local | s3)
│   ├── seeds/              # Seed + verification scripts
│   └── .env.example
├── deploy/                 # docker-compose.livekit.yml + livekit.yaml
├── docs/                   # LIVEKIT.md, STORAGE.md
└── docker-compose.yml
```

---

## Prerequisites

- **Node.js ≥ 18** (developed on Node 22) and **npm**.
- **MongoDB** — a connection string (MongoDB Atlas or a local/self-hosted instance).
- *(optional)* **Docker** — for running LiveKit and/or Judge0 locally.
- *(optional)* API keys for AI features (see [Environment variables](#environment-variables)).

The platform runs with only MongoDB + a JWT secret. Every external service (AI, video, code execution, email, S3) degrades gracefully when its keys are unset.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/MelvinDenish/PRISM.git
cd PRISM

# 2. Server
cd server
npm install
cp .env.example .env          # then edit .env — set MONGODB_URI and JWT_SECRET
node seeds/seedAll.js         # seed topics, resources, and sample users (optional)
npm run dev                   # starts on http://localhost:5000

# 3. Client (in a second terminal)
cd ../client
npm install
cp .env.example .env.local    # defaults point at http://localhost:5000
npm run dev                   # starts on http://localhost:5173
```

Open **http://localhost:5173** and register, or sign in with a seeded account (see `USERS.txt`).

> On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

---

## Environment variables

Full, annotated references live in **[`server/.env.example`](server/.env.example)** and **[`client/.env.example`](client/.env.example)**. The server validates required vars at boot and **refuses to start** if a required one is missing or weak.

### Server (`server/.env`)

**Required**

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string. Server exits if missing. |
| `JWT_SECRET` | Long random string for signing tokens (min 16 chars). |

**Optional (sensible defaults)** — `JWT_EXPIRE` (`7d`), `PORT` (`5000`), `NODE_ENV`, `CLIENT_URL` (comma-separated CORS/Socket.IO origins), `JUDGE0_API_URL`, `LOG_LEVEL`.

**Feature-gated** (capability silently disabled when unset)

| Variable | Enables |
|----------|---------|
| `GROQ_API_KEY` | AI interview, interview game, group discussion, resume builder, summarize, learning paths. |
| `GEMINI_API_KEY` | Resume ATS analysis (falls back to keyword matching). |
| `TAVILY_API_KEY` | Interview Game company-question research pipeline. |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_*_MODEL` | PRISM Copilot's tool-calling LLM (OpenAI-compatible; falls back to Groq). |
| `LIVEKIT_WS_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Live video (mentorship, interviews, GD, webinars). |
| `EMAIL_USER` / `EMAIL_PASS` | Email notifications via Gmail SMTP (use an App Password). |
| `STORAGE_DRIVER` + `S3_*` | File storage backend (`local` default, or `s3`/MinIO). |

### Client (`client/.env.local`)

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | `http://localhost:5000` |

---

## Scripts

Run from the matching subdirectory.

**Server** (`server/`)

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start with `node --watch` (auto-restart) on port 5000 |
| `npm start` | Production start |

**Client** (`client/`)

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint (flat config) |

> No automated test runner is configured. The `server/seeds/verify*.js` scripts act as integration smoke checks against a running server/DB.

---

## Seeding data

Run from `server/` against your configured `MONGODB_URI`:

```bash
node seeds/seedAll.js          # topics, resources, sample users (re-running WIPES & repopulates)
node seeds/seedQuestionBank.js # Interview Game MCQ bank (separate from seedAll)
node seeds/seedCompanies.js    # company eligibility data
node seeds/seedDSA.js          # DSA coding problems
```

Seeded sample accounts and credentials are listed in `USERS.txt`.

---

## Architecture

### Server

`server/server.js` is a single Express app sharing its HTTP port with Socket.IO. `connectDB()` runs on import; each feature has its own router in `routes/` mounted under `/api/<feature>`. There is no central router file — adding an endpoint means: create the model in `models/`, create the router in `routes/`, register it with `app.use(...)` in `server.js`, and add an axios wrapper in `client/src/services/api.js`.

- **Auth** — `middleware/auth.js` exports `protect` (verifies the `Bearer` JWT and loads `req.user`) and `authorize(...roles)` (role gate). Roles are exactly `mentor | mentee | admin`.
- **Response shape** — every endpoint returns `{ success: boolean, ...data, message? }`. The client interceptor redirects to `/login?expired=1` on any `401`.
- **AI routes** — the Groq client is constructed lazily per request (throws if the key is unset); JSON prompts strip code fences before parsing.
- **Code execution** — tries Judge0 first, then falls back to local `child_process` execution, guarded by a per-language dangerous-pattern allowlist.

### Realtime

`server/socket/socketHandler.js` holds in-memory maps for interview coding rooms, GD participants, mentorship peers, and online presence (flipping `User.isOnline`). **State is process-local** — there is no Redis adapter, so horizontal scaling requires one. Live audio/video is handled by a self-hosted **LiveKit** SFU; the server mints access tokens at `/api/rtc/token`.

### Client

Vite + React 19 + React Router 7. `App.jsx` defines all routes; protected routes wrap in `<ProtectedRoute>` reading `useAuth()`. `AuthContext` stores the JWT in `localStorage` (`prism_token`), hydrates the user from `GET /api/auth/me`, and opens a single presence socket on login. **All HTTP calls go through `client/src/services/api.js`** — never call `axios` directly from a component.

---

## API surface

All routers are mounted under `/api`:

```
/api/auth              /api/users             /api/companies
/api/topics            /api/resources         /api/progress
/api/mentorship        /api/availability      /api/coding-questions
/api/resume-analysis   /api/notifications     /api/analytics
/api/interview-game    /api/question-bank     /api/ai-interview
/api/resume-builder    /api/learning-paths    /api/behavioral
/api/behavioral-practice /api/review          /api/code-execution
/api/group-discussion  /api/gd-rooms          /api/webinars
/api/summarize         /api/rtc               /api/assistant
/api/artifacts         /api/prep-profile
```

---

## Optional services

| Service | Purpose | Setup |
|---------|---------|-------|
| **LiveKit** | Live 1:1, GD, interview, and webinar video | `deploy/docker-compose.livekit.yml` + `deploy/livekit.yaml`; see [`docs/LIVEKIT.md`](docs/LIVEKIT.md) |
| **Judge0** | Sandboxed code execution (falls back to local runtimes) | `judge0-docker-compose.yml`; set `JUDGE0_API_URL` |
| **S3 / MinIO** | Durable file storage for resumes, resources, avatars | `STORAGE_DRIVER=s3` + `S3_*`; see [`docs/STORAGE.md`](docs/STORAGE.md) |
| **Groq / OpenAI-compatible LLM** | AI features + PRISM Copilot | Set `GROQ_API_KEY` (and optionally `LLM_*`) |

Local code execution fallback requires `node`, `python`/`python3`, `g++`/`gcc`, and `javac`/`java` on `PATH`.

---

## Further documentation

- [`docs/LIVEKIT.md`](docs/LIVEKIT.md) — LiveKit SFU provisioning (ports, TURN, TLS).
- [`docs/STORAGE.md`](docs/STORAGE.md) — file storage runbooks (AWS S3 + MinIO).
- [`CLAUDE.md`](CLAUDE.md) — detailed architecture notes and conventions for contributors.

---

## Conventions

- **CommonJS** on the server (`require`/`module.exports`); **ESM** on the client (`import`/`export`).
- Mongoose models are required ad-hoc inside route files — there's no central model index.
- Don't add a root `package.json` or workspace config — the two-package layout is intentional.
- Styling is plain CSS; the brand uses an emerald/teal gradient (`#10b981` → `#14b8a6`) on a dark background (`#0a1a1c`).
- ESLint's `no-unused-vars` ignores identifiers matching `^[A-Z_]` (uppercase-prefixed unused vars are intentional).

---

## Troubleshooting

- **Server won't start** — confirm `MONGODB_URI` and `JWT_SECRET` are set in `server/.env`; the server exits on missing required vars.
- **AI routes return errors** — set `GROQ_API_KEY`. Routes throw (rather than silently no-op) when their key is missing.
- **Live video doesn't connect** — set the three `LIVEKIT_*` vars; `/api/rtc/token` returns `503` until they're present.
- **CORS / socket blocked** — add your client origin to `CLIENT_URL` (comma-separated).
- **Getting logged out unexpectedly** — any `401` triggers a redirect to `/login?expired=1`; check the token in `localStorage` (`prism_token`).
