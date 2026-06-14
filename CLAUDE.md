# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**PRISM** (Placement Resources & Interview Skill Manager) — a mentor/mentee placement-preparation platform. Two-package monorepo (no workspace tooling): React + Vite client and Express + MongoDB server, wired together with Socket.IO and PeerJS for realtime features.

## Commands

Run from the matching subdirectory (`client/` or `server/`). The repo root has no `package.json`.

**Server** (`server/`):
- `npm install` — install
- `npm run dev` — start with `node --watch server.js` (auto-restart); listens on port `5000`
- `npm start` — production start
- `node seeds/seedAll.js` — seed topics, resources, sample users (re-running wipes & repopulates)
- `node seeds/seedQuestionBank.js` — seed Interview Game MCQ bank (separate from `seedAll`)

**Client** (`client/`):
- `npm install` — install
- `npm run dev` — Vite dev server on port `5173`
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run preview` — preview production build

No test runner is configured in either package.

## Environment

Server reads from `server/.env`:
- `MONGODB_URI` — MongoDB Atlas connection string (required; server exits if missing)
- `JWT_SECRET`, `JWT_EXPIRE` (default `7d`)
- `GROQ_API_KEY` — required for any AI route (`/api/ai-interview`, `/api/interview-game`, `/api/group-discussion`, `/api/resume-builder`, `/api/learning-paths`, `/api/summarize`, `/api/resume-analysis`). Routes throw on missing key; don't add fallbacks.
- `EMAIL_USER`, `EMAIL_PASS` — Gmail SMTP for `utils/emailService.js`; if absent, email is silently disabled (no error).
- `CLIENT_URL` — comma-separated allowed origins for CORS and Socket.IO. Defaults to `http://localhost:5173`.
- `JUDGE0_API_URL` — optional Judge0 CE endpoint for `/api/code-execution`. If unreachable, the route falls back to local `child_process` execution (`node`, `python`/`python3`, `g++`, `gcc`, `javac`/`java` must be on PATH).
- `TAVILY_API_KEY` — optional. Enables the Interview Game's company interview-question research pipeline (`server/agent/services/companyResearch.js`): search → fetch → Readability → LLM-structure → `QuestionBank` (`source:'research'`). When unset, research is disabled and the game serves mentor-uploaded + curated questions only (graceful degradation, like the other AI keys).
- `PORT` — defaults to `5000`.

Client reads `VITE_API_URL` (default `http://localhost:5000/api`) and `VITE_SOCKET_URL` (default `http://localhost:5000`). See `client/.env.example`.

## Architecture

### Server (`server/server.js`)
Single Express app + HTTP server sharing the port with Socket.IO. `connectDB()` runs at import; routes are mounted from `routes/*.js` under `/api/<feature>`. There's no central router file — adding an endpoint means: create model in `models/`, create router in `routes/`, register with `app.use(...)` in `server.js`, and add an axios wrapper in `client/src/services/api.js`.

**Auth pattern.** `middleware/auth.js` exports `protect` (verifies `Bearer` JWT from `Authorization` header, loads `req.user` minus password) and `authorize(...roles)` (role gate using `req.user.role`). Roles are exactly `mentor | mentee | admin`. Every protected route follows `router.post('/x', protect, handler)` or `protect, authorize('mentee'), handler`. `req.user._id` is the canonical user id.

**Response shape.** All endpoints return `{ success: boolean, ...data, message? }`. The client's axios interceptor (`client/src/services/api.js`) auto-redirects to `/login?expired=1` on any `401`, so don't repurpose 401 for non-auth errors.

**AI routes.** Every Groq-backed route constructs the client lazily via a local `getGroq()` (throws if `GROQ_API_KEY` unset) — do not module-load the SDK at top level. Default model is `llama-3.1-8b-instant`. JSON-returning prompts always strip ```` ```json ```` fences before `JSON.parse`; preserve that pattern when adding new AI calls.

**Code execution (`routes/codeExecution.js`).** Try Judge0 first, then fall back to local `child_process` writing temp files to `os.tmpdir()`. There's an explicit `DANGEROUS_PATTERNS` regex allowlist per language that blocks fs/network/subprocess imports before execution. Any new language must add both a Judge0 `LANG_MAP` entry and a `DANGEROUS_PATTERNS` entry — never bypass `validateCode`.

### Socket.IO (`server/socket/socketHandler.js`)
One handler holds four in-memory `Map`s: `rooms` (interview coding rooms), `gdVideoRooms` (Group Discussion PeerJS participants), `sessionPeers` (1:1 mentorship video peers), `userSockets` (online presence → flips `User.isOnline`). State is process-local — there is no Redis adapter, so horizontal scaling will break presence and rooms.

**WebRTC signaling convention.** When a peer joins, the server tells the **new** joiner to *call* existing peers (`call-peer` / `gd-peer-joined` sent to the new socket) and tells **existing** peers to *wait* (`incoming-peer` to the room). Don't symmetrize this — both sides calling causes duplicate streams.

**GD timer.** `start-gd` schedules three `setTimeout`s for 5-min warning / 1-min warning / end. These live in memory and won't survive a server restart; treat them as best-effort.

### Client (`client/src/`)
Vite + React 19 + React Router 7. `App.jsx` defines all routes — protected routes wrap in `<ProtectedRoute>` which reads `useAuth()`. `AuthContext` (`context/AuthContext.jsx`) stores JWT in `localStorage` under `prism_token`, hydrates `user` from `GET /api/auth/me` on mount, and opens a single Socket.IO connection on login to emit `register-user` for presence tracking.

**API layer.** All HTTP calls go through `client/src/services/api.js` — never call `axios` directly from a component. The interceptor reads `prism_token` from localStorage and attaches `Authorization`. When adding a server route, add a matching named export here.

**Realtime pages.** `TechnicalInterview`, `VideoCall`, `GDRooms`, and `InterviewGame` each open their own Socket.IO + PeerJS connections (separate from `AuthContext`'s socket). PeerJS uses the default public broker — there's no self-hosted PeerServer.

**Styling.** Plain CSS in `index.css` and component-adjacent `*.css` files. No CSS-in-JS, no Tailwind. The brand uses an emerald/teal gradient on a dark background (`#10b981` → `#14b8a6` on `#0a1a1c`); see email templates and existing pages for the palette.

## Conventions

- CommonJS on server (`require`/`module.exports`); ESM on client (`import`/`export`).
- Mongoose models are required ad-hoc inside route files — there's no central model index.
- Don't add a root `package.json` or workspace config without checking — the two-package layout is intentional.
- ESLint rule `no-unused-vars` ignores identifiers matching `^[A-Z_]`; uppercase-prefixed unused vars are intentional.
