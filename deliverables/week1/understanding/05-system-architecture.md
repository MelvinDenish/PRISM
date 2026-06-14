# 05 — System Architecture

This document explains **how the system is structured and how a request flows through
it**, from the browser to the database and back, including the realtime, AI, and
code-execution sub-systems, and the production deployment topology.

---

## 5.1 High-level architecture

PRISM is a **client–server web application** with a clear split:

```
┌──────────────────────────────┐         ┌────────────────────────────────────────────┐
│      CLIENT (browser)         │         │              SERVER (Node.js)               │
│  React 19 SPA (Vite build)    │         │     Express (HTTP)  +  Socket.IO (WS)        │
│                               │  HTTPS  │                                              │
│  • Pages / Components         │◀───────▶│  Middleware → Routes → Controllers → Models  │
│  • axios (REST, sends JWT)    │  REST   │                                  │           │
│  • socket.io-client (realtime)│◀───────▶│            ┌─────────────────────┘           │
│  • PeerJS (P2P video)         │   WS    │            ▼                                  │
└──────────────────────────────┘         │      ┌───────────┐   external services:       │
                                          │      │  MongoDB  │   Groq/Gemini (AI)         │
        (video flows peer-to-peer,        │      └───────────┘   Judge0 (code exec)       │
         not through the server)          │                      SMTP (email)             │
                                          └────────────────────────────────────────────┘
```

- The **client** is a **Single-Page Application (SPA)**: the browser downloads one
  bundle, and React Router swaps "pages" client-side without full reloads. It talks to
  the server two ways: **REST over HTTPS** (via axios) for request/response actions, and
  **WebSocket** (via Socket.IO) for realtime events.
- The **server** is one Node.js process running **two protocols on one port**: Express
  for HTTP/REST and Socket.IO for WebSockets, sharing the same HTTP server object.
- **Video** does not pass through the server — it flows **peer-to-peer** (WebRTC); the
  server only helps the peers find each other (signaling).

---

## 5.2 The server's layered design

The server follows a layered structure (each layer has one responsibility):

```
  HTTP request
      │
      ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. Cross-cutting middleware                                    │
│    cors → json body parser → requestContext (request id+log)   │
│         → rate limiter                                         │
├───────────────────────────────────────────────────────────────┤
│ 2. Routing            app.use('/api/<feature>', router)        │
├───────────────────────────────────────────────────────────────┤
│ 3. Route middleware   protect (JWT) → authorize(role)          │
│                       → validate(schema)                       │
├───────────────────────────────────────────────────────────────┤
│ 4. Handler (controller)  business logic                        │
├───────────────────────────────────────────────────────────────┤
│ 5. Model layer (Mongoose)  schema + DB access                  │
├───────────────────────────────────────────────────────────────┤
│ 6. Error handler (last)  maps errors → correct HTTP status     │
└───────────────────────────────────────────────────────────────┘
      │
      ▼
  HTTP response  { success, ... }
```

**Why layered:** each concern is isolated and reusable. Authentication is written once
(`protect`) and applied to every protected route; validation rules are declared once
per endpoint; error handling is centralized so no handler has to format error
responses. A student adding a new endpoint follows a fixed recipe: *create a model →
create a router → register it in `server.js` → add an axios wrapper on the client.*

**A note on the convention:** PRISM uses a thin-controller style — the route file
contains the handler logic directly rather than a separate `controllers/` folder. For a
project this size that is appropriate (fewer files to jump between); the layering is
still present logically.

---

## 5.3 The request lifecycle (end-to-end example)

Take **"a mentee books a slot."** Step by step:

1. **Browser** — the React page calls `bookSlot()` in `services/api.js`, which is an
   axios wrapper. An axios **interceptor** reads the JWT from `localStorage` and adds
   `Authorization: Bearer <token>`.
2. **Network** — `PATCH /api/availability/book/0` goes to the server over HTTPS.
3. **Middleware** — `cors` checks the origin → the JSON body parser parses the body →
   `requestContext` assigns a unique **request id** and starts a timer → the **rate
   limiter** checks this IP hasn't exceeded its quota.
4. **Routing** — Express matches `/api/availability` and hands off to its router.
5. **Route middleware** — `protect` verifies the JWT, loads the user, and confirms the
   token wasn't issued before the user's last password change.
6. **Handler** — runs the **atomic conditional update** to claim the slot (§4.6).
7. **Model/DB** — Mongoose translates that into a MongoDB `findAndModify`; the database
   executes it atomically and returns the updated document (or null).
8. **Response** — the handler returns `{ success: true, availability }` (or a `409` if
   the slot was already taken).
9. **Error path** — if anything threw, control jumps to the **central error handler**,
   which maps the error type to the right status (e.g. a bad ObjectId → 400, not 500)
   and logs it with the request id.
10. **Browser** — axios resolves; React updates the UI. If the server returned `401`,
    a global interceptor redirects to the login page.

---

## 5.4 Authentication architecture (JWT)

PRISM is **stateless** on the auth side — it uses **JSON Web Tokens** rather than
server-side sessions.

- On login, the server signs a JWT containing the user's id and an issued-at timestamp
  (`iat`), using the secret `JWT_SECRET`.
- The browser stores it (`localStorage`) and sends it on every request.
- On each protected request, `protect` **verifies the signature** (proving the token
  wasn't forged or tampered with — the math is `HMAC-SHA256(header.payload, secret)`),
  then loads the user.

**Why stateless matters:** the server keeps no session table, so any server process can
validate any token. That is what lets the platform run multiple processes / scale
horizontally without sharing session state.

**Token invalidation:** the weakness of stateless JWTs is that they can't be "logged
out" server-side. PRISM solves this with `passwordChangedAt`: when a user resets their
password, that timestamp is updated, and `protect` rejects any token whose `iat` is
older than it. (Internals: Document 07, §7.6.)

---

## 5.5 Realtime architecture (Socket.IO + WebRTC)

There are **two distinct realtime mechanisms**, often confused:

### (a) Socket.IO — server-mediated events
A persistent **WebSocket** connection between each browser and the server, used for:
- **Presence** (who is online),
- **Coding-room sync** (shared editor state in an interview),
- **Chat / GD messages**,
- **WebRTC signaling** (passing connection offers between peers).

Socket.IO organises clients into **rooms** and broadcasts events to them. Crucially,
every socket connection is now **authenticated with a JWT handshake** — the server
derives the user's identity from the verified token, never from what the client claims
(Document 07, §7.4).

> **Current limitation & plan:** the rooms/presence state lives in the server process's
> memory. With one process that's fine; to run multiple processes (for scale) this state
> must move to **Redis** (a shared in-memory store) so all processes see the same rooms.
> This is the next planned Phase-2 task.

### (b) WebRTC — peer-to-peer media
The actual **video/audio streams flow directly between two browsers**, not through the
server. PeerJS handles the WebRTC handshake. The server (via Socket.IO) only does
**signaling** — telling peer A how to reach peer B. This keeps video bandwidth off the
server entirely.

**Signaling convention (important, and easy to get wrong):** when a new peer joins, the
server tells the **new** peer to *call* the existing peers, and tells the existing peers
to *wait*. If both sides called each other, you'd get duplicate streams. This asymmetry
is deliberate.

---

## 5.6 AI integration pattern

Every AI feature (interview, interview-game questions, group discussion, résumé
generation, ATS analysis, learning paths, summarization) follows the same pattern:

```
user input → server builds a prompt → calls LLM (Groq/Gemini) → parses the reply → returns structured data
```

Design rules the codebase follows:
- **Lazy client construction:** the LLM SDK client is created **inside** the handler
  via a local `getGroq()` that throws if the API key is missing — never at module load.
  This is why a missing key disables only that feature instead of crashing the server.
- **Default model:** `llama-3.1-8b-instant` (fast and cheap) on Groq; Gemini for ATS.
- **JSON discipline:** prompts that must return JSON strip ```` ```json ```` fences
  before `JSON.parse`. *(Hardening this parsing — validating the parsed shape instead of
  silently falling back to dummy data — is a planned Phase-2 task.)*
- **Cost/abuse control:** AI endpoints are rate-limited, and user text is length-capped
  before it enters a prompt (Document 07, §7.7).

---

## 5.7 Code-execution architecture (the sandbox)

The coding rounds let users run untrusted code in 5 languages. This is the most
dangerous feature in the whole system, so its architecture is security-first:

```
code → validate → Judge0 (sandboxed container) → result
                       │ (if Judge0 down)
                       ▼
            DEV ONLY: local child_process     ← disabled in production
            PROD:     refuse + clear error
```

- **Judge0** is a dedicated, sandboxed execution engine (each run is isolated in a
  container with CPU/memory/time limits and no network or host file access).
- The old code had a **local fallback** that ran user code directly on the server with a
  regex "blocklist." That is effectively **remote code execution** if exposed. In Week 1
  this fallback was **disabled in production** — production *requires* Judge0 and returns
  a clear "service unavailable" error rather than running code on the host (Document 07,
  §7.3).

---

## 5.8 Production deployment topology (institution-hosted)

```
                 Internet / college network
                          │
                          ▼
                 ┌──────────────────┐
                 │ nginx (TLS, 443) │   reverse proxy + serves the React build
                 └────────┬─────────┘
                          │
            ┌─────────────┼──────────────────────────────┐
            ▼             ▼                               ▼
   ┌─────────────────┐  ┌──────────────────┐   (static React bundle)
   │ Node app (PM2)  │  │ Node app (PM2)    │   ... cluster of processes
   └───────┬─────────┘  └────────┬─────────┘
           └──────────┬──────────┘
                      ▼
        ┌────────┬─────────┬─────────┬──────────┐
     MongoDB   Redis    Judge0     coturn      SMTP
   (database) (realtime (sandbox  (TURN for   (email)
              state)    exec)     video NAT)
```

- **nginx** terminates TLS and serves the static React build; it proxies `/api` and the
  WebSocket upgrade to the Node processes.
- **PM2** runs and supervises the Node process(es), restarting on crash.
- **Docker** packages MongoDB, Redis, Judge0, and coturn so the whole stack comes up
  with one command on the college VM. (`docker-compose.yml` already provisions MongoDB;
  the others are added as their phases land.)

This topology needs **no cloud account and no paid managed service** — it runs entirely
on hardware the institution controls, which was a core requirement (Document 01, §1.7).

---

## 5.9 Architectural principles (summary)

1. **Separation of concerns** — layered server, SPA client, isolated sub-systems.
2. **Stateless core** — JWT auth and stateless HTTP make the app horizontally scalable.
3. **Security at the boundary** — every entry point (REST, WebSocket, code exec) is
   authenticated and validated; nothing trusts client-supplied identity or scores.
4. **Graceful degradation** — a missing optional dependency disables one feature, never
   the platform.
5. **Self-hostable** — the entire stack runs on one institution VM via Docker.
