# 07 — Work Completed: Deep Technical Dive

This is the deepest document. For each change made in Week 1 it answers three
questions, not one:

1. **Why** — what was broken or missing, and what would go wrong without the fix.
2. **How it works internally** — the mechanism at the level of the language, runtime,
   or database, not just "what was added."
3. **How it was verified** — the actual test and its observed output.

Everything below was implemented and tested against a **Dockerized MongoDB** during
Week 1.

---

## 7.0 Setup: MongoDB in Docker

Before any testing, a local database was needed. Rather than depend on a cloud
(MongoDB Atlas) connection — which is slow to reach and can't be reset freely — MongoDB
runs locally in a **Docker container**, defined in `docker-compose.yml`.

**Why Docker:** a container is an isolated, reproducible package of software. `docker
compose up -d` starts MongoDB with one command, with its data stored in a named
**volume** (so data survives restarts but can be wiped with `down -v`). Every developer
and every test run gets an identical database — no "works on my machine" drift.

**How it works internally:** Docker uses the host OS kernel but isolates the container's
filesystem, processes, and network namespace. The `ports: ["27017:27017"]` line maps the
container's MongoDB port to the host, so the Node app connects to
`mongodb://localhost:27017/prism` as if MongoDB were installed natively.

---

## 7.1 Phase 0 — Foundations

These are the reliability features everything else stands on.

### 7.1.1 Boot-time environment validation (`config/env.js`)

**Why.** The server reads ~10 configuration values from environment variables
(`MONGODB_URI`, `JWT_SECRET`, API keys, …). Previously, if a *required* one was missing
or a secret was weak, the server would start anyway and then fail confusingly deep
inside a request — e.g. JWTs signed with `undefined` as the secret. The failure was
far from the cause.

**How it works internally.** `dotenv` reads the `.env` file and copies each `KEY=value`
line into `process.env` (Node's global environment object). The new `validateEnv()`
function then checks `process.env` against a schema:
- **required** variables (`MONGODB_URI`, `JWT_SECRET`) → if missing, `process.exit(1)`
  immediately with a clear message. Exit code 1 signals failure to the OS / process
  manager so it won't silently appear "up."
- **default** variables → filled in if absent (e.g. `PORT=5000`).
- **feature-gated** variables (API keys) → only a warning; the matching feature is
  disabled but the server still boots.

`JWT_SECRET` additionally must be ≥16 characters, because a short secret makes the
HMAC signature on every JWT brute-forceable.

**Verification (observed):**
```
$ node -e "delete MONGODB_URI/JWT_SECRET; validateEnv()"
❌ Environment validation failed:
   • Missing required env var: MONGODB_URI
   • Missing required env var: JWT_SECRET
exit=1
```
The process exits 1 with the exact missing variables named — the failure now happens at
boot, pointing straight at the cause.

### 7.1.2 Structured logging + request IDs (`utils/logger.js`, `middleware/requestContext.js`)

**Why.** The old code logged with `console.log`/`console.error` — unstructured text,
with no way to correlate the lines belonging to one request. When two requests
interleave, you cannot tell which log line came from which.

**How it works internally.** `requestContext` is Express middleware that runs on every
request. It:
1. Generates a unique **request id** (`crypto.randomUUID()` — a 128-bit random UUID)
   and attaches it as `req.id` and the `X-Request-Id` response header.
2. Creates a **child logger** bound to that id, so every log line for this request
   carries `requestId`.
3. Registers a callback on the response's `finish` event (Node's `http.ServerResponse`
   emits `finish` when the response is fully sent). At that point it logs the method,
   path, status, and **duration** — measured with `process.hrtime.bigint()`, a
   high-resolution monotonic clock (nanosecond precision, unaffected by wall-clock
   changes).

The logger itself emits **one JSON object per line**. JSON lines are machine-parseable —
a log aggregator can filter by `requestId` or `status` — while still being readable.

**Why a child logger:** it captures the request id once and injects it into every
subsequent line automatically, so handlers don't have to thread the id through manually.

### 7.1.3 Centralized error handling (`middleware/errorHandler.js`)

**Why.** The old catch-all returned **HTTP 500 for every error**, including client
mistakes like a malformed id or a duplicate email. 500 means "server fault" — telling a
client "you sent a bad request" with a 500 is both wrong and unhelpful (clients retry
500s; they shouldn't retry a 400).

**How it works internally.** Express recognises **error-handling middleware** by its
**four-argument signature** `(err, req, res, next)` — the extra first parameter is how
Express distinguishes it from normal middleware. Mounted **last**, it catches anything
passed to `next(err)` or thrown in an `asyncHandler`-wrapped route.

It then **normalises** the error to the correct status:
- A custom `AppError` carries its own `statusCode`.
- A Mongoose `ValidationError` → 400 (client sent invalid data).
- A Mongoose `CastError` (bad ObjectId) → 400.
- A MongoDB duplicate-key error (`code 11000`) → 409 (conflict).
- A `JsonWebTokenError` / `TokenExpiredError` → 401.
- Anything unrecognised → 500 (a genuine server fault), and *that* is logged with the
  stack trace.

`asyncHandler` is a one-line wrapper — `(fn) => (req,res,next) => Promise.resolve(fn(...)).catch(next)`
— that forwards any rejected promise from an `async` handler into this error pipeline.
Without it, an unhandled promise rejection in an async route would hang the request.

### 7.1.4 Validation & rate limiting (`middleware/validate.js`, `middleware/rateLimit.js`)

**Validation — why & how.** Each route previously hand-wrote `if (!email) return 400…`
checks, inconsistently. `validate(schema)` declares the rules once (required, type,
length, email format, regex pattern) and runs them before the handler, returning a 400
with a list of every problem. It also **coerces and sanitizes** (trims strings, casts
`"22"`→`22`), so the handler receives clean data. This is **defence in depth**: never
trust client input.

**Rate limiting — why & how.** `express-rate-limit` keeps a per-IP counter in a sliding
time window. Three tiers were defined:
- **auth** (20 / 15 min) — throttles password-guessing / credential stuffing.
- **AI** (40 / 15 min) — LLM calls cost money; this caps abuse.
- **code-exec** (30 / min) — each run spawns a sandbox job; this prevents resource
  exhaustion.
When the counter exceeds the limit, the request is rejected with **429 Too Many
Requests** before reaching the handler.

---

## 7.2 The Interview-Game score-forgery fix (the headline security fix)

### Why it was critical
The Interview Game has a leaderboard. The old flow was:
1. The server sent each MCQ to the browser **including the correct answer** (`ans`).
2. The browser compared the user's choices to those answers and computed a score.
3. The browser sent that score (`aiScore`) to the server, which **saved it as-is.**

Two independent holes: the browser **receives the answer key** (so a user can read it
in dev-tools), and the browser **reports its own grade** (so a user can simply
`POST {aiScore: 100}`). On a leaderboard the whole college can see, this is fatal.

### How the fix works internally
The principle: **the server, not the client, must be the source of truth for a score.**
To grade on the server, the server must remember *which questions it served and what
their answers are* — without ever sending those answers to the client.

1. **Store the answer key when serving.** The `InterviewGame` round schema gained a
   field `servedQuestions: [{ questionId, ans }]`. When the client requests a round's
   questions (now passing its `gameId`), the server saves the correct answers into that
   round, then **strips `ans` and `explanation` from the response**:
   ```js
   gameRound.servedQuestions = questions.map(q => ({ questionId: q.id, ans: q.ans }));
   await game.save();
   questions = questions.map(({ ans, explanation, ...rest }) => rest); // answer key removed
   ```
   The `({ ans, explanation, ...rest }) => rest` is JavaScript **object destructuring
   with rest** — it pulls `ans` and `explanation` out and keeps everything else, i.e. it
   returns the question *without* the answer.

2. **Grade on submit, ignore the client's score.** A pure function `gradeMcqRound`
   builds a map from `questionId → correct answer` from `servedQuestions`, then counts
   how many of the user's submitted answers match — normalising with `String(x).trim()`
   on both sides so formatting/whitespace can't cause false mismatches. The score is
   `correct / number-served` (so leaving questions blank lowers the score). The
   client-supplied `aiScore` is **never read** for MCQ rounds.

3. **Never leak the key anywhere.** A `sanitizeGame()` helper strips `servedQuestions`
   from *every* game object returned by *any* endpoint (start, submit, history, get-one),
   because the answer key now lives on the game document and must not ride along in any
   response.

4. **Ownership.** `submit-round` and `get-one` now verify `game.user == currentUser`, so
   a user cannot submit to or read someone else's game.

### Why a separate pure function (`gradeMcqRound`)
By keeping the grading logic as a side-effect-free function (no database, no `req`/`res`),
it can be **unit-tested in isolation** — feed it synthetic served-questions and answers
and assert the score. This is faster and more thorough than only testing through HTTP.

### Verification (observed)
A standalone unit suite asserted: all-correct → 100; all-wrong → 0; blanks penalised
(2 of 4 → 50); whitespace tolerated; a forged `isCorrect:true / aiScore:100` is ignored
(0); and — the critical one — `sanitizeGame()` output contains **no `servedQuestions`
and no `ans`** anywhere. Result: **all assertions passed.**

---

## 7.3 Code-execution sandbox (closing a remote-code-execution path)

### Why it was critical
The coding feature ran user code. It tried **Judge0** (a real sandbox) first, but if
Judge0 was unreachable it **fell back to running the code directly on the server** via
Node's `child_process`, guarded only by a **regex blocklist** of "dangerous" patterns.

A regex blocklist is fundamentally bypassable — e.g. `require("f"+"s")` or
`globalThis["pro"+"cess"]` evade a pattern matching the literal text. Code that escapes
the regex then runs **with the server's own privileges**: it can read environment
variables (including secrets), the filesystem, and the network. For a publicly-exposed
app, that is **remote code execution (RCE)** — the most severe class of vulnerability.

### How the fix works internally
The fix gates the dangerous fallback on the environment:
```js
} catch (judge0Err) {
    if (config.isProduction()) {
        return { stdout: '', stderr: 'Code execution service is temporarily unavailable...', exitCode: 1 };
    }
    return executeLocal(language, sourceCode, stdin); // dev convenience only
}
```
In **production** (`NODE_ENV=production`), if Judge0 is down the server **refuses to run
the code** and returns a clear error — it never executes untrusted code on the host. The
local fallback survives only in development, where convenience outweighs risk and no
untrusted users exist. The exec routes were also put behind the **code-exec rate
limiter**.

**Why not just improve the regex:** you cannot enumerate every way to obfuscate a string
in a Turing-complete language. The only correct boundary is a real sandbox (Judge0's
isolated container with no host access), so the fix removes reliance on the blocklist
entirely in production.

---

## 7.4 Socket.IO authentication

### Why it was critical
The realtime layer (presence, rooms, signaling) trusted **whatever identity the client
announced** in its events — e.g. a client could emit `register-user` with *any* user id,
or join *any* room id. Anyone could impersonate another user or eavesdrop on a room.

### How it works internally
A **handshake authentication middleware** now runs when a socket connects, *before* any
event is processed. The client supplies its JWT in the connection handshake; the server
**verifies the signature** (same `JWT_SECRET` as REST), loads the user, and attaches the
**server-derived identity** to the socket. From then on, the server uses *that* identity
— never an id the client puts in an event payload. A socket without a valid token is
rejected at connection time.

**Why handshake-time:** authenticating once at connection (rather than per-event) means
every subsequent event is already trusted, and an unauthenticated socket never gets far
enough to do anything.

---

## 7.5 Role + ownership access control (fixing IDOR)

### Why it was critical
Several endpoints checked that the caller was **logged in** (authentication) but not that
they were **allowed to touch this specific record** (authorization). This is the
**IDOR** bug class — *Insecure Direct Object Reference*. Concrete examples found:
- Any mentor could edit/delete **any** resource (not just their own).
- Any user could mark **another user's** notification as read.
- Any user could rate a mentorship session they **weren't part of** — and a mentee's
  rating changes a mentor's public average, so this let strangers skew ratings.

> **Authentication vs. authorization:** authentication answers "who are you?";
> authorization answers "are *you* allowed to do *this to this record*?" Checking only
> the first is the most common access-control mistake.

### How it works internally
An `isOwner(record, req, ownerField)` helper compares the record's owner field (e.g.
`uploadedBy`) to the current user, treating admins as allowed for any record. Each
vulnerable handler now: loads the record, checks `isOwner` (or participant membership),
and returns **403 Forbidden** if the check fails — *before* mutating anything. For
resource edit, the owner field can't be reassigned by the request body either.

For mentorship rating specifically, the handler now confirms the rater is one of the
session's two participants and keys the mentee/mentor branch off **actual participation**,
not the caller's global role.

### Verification (observed)
An integration suite against Docker MongoDB created two mentors + an admin and a resource
owned by one mentor, then asserted: the other mentor editing it → **403**; deleting it →
**403**; the owner editing → **200**; the admin deleting → **200**; a non-owner marking a
notification read → **404**; the owner → **200**. Result: **6/6 passed.**

---

## 7.6 Authentication hardening

Four related mechanisms; each explained with its internals.

### 7.6.1 Strong password policy
Registration and reset now require ≥8 characters with at least one letter and one digit,
enforced by a regex `^(?=.*[A-Za-z])(?=.*\d).{8,}$`. The `(?=...)` are **lookaheads** —
zero-width assertions that check "a letter exists somewhere" and "a digit exists
somewhere" without consuming characters — so the rule is "contains a letter AND a digit
AND is ≥8 long."

### 7.6.2 Account lockout
The `User` gained `failedLoginAttempts` and `lockUntil`. On a wrong password the counter
increments; at 5 it sets `lockUntil = now + 15 min`. While locked, even the correct
password is refused with **423 Locked**. A successful login clears the counter. This
caps online password-guessing — the per-IP rate limiter and the per-account lockout
together defend from both directions.

### 7.6.3 Password reset (with hashed tokens)
`forgot-password` generates a **random token** (`crypto.randomBytes(32)`), emails the
**raw** token in a link, but stores only its **SHA-256 hash** (`resetPasswordToken`) plus
a 30-minute expiry. `reset-password` hashes the incoming token and looks for a matching,
unexpired record.

**Why store a hash, not the token:** if the database leaked, an attacker would get only
hashes — useless for resetting accounts, because they can't reverse SHA-256 to the raw
token the email link needs. This mirrors how passwords themselves are stored. Also,
`forgot-password` **always returns 200**, even for an unknown email, so the response
can't be used to discover which emails are registered (no *user enumeration*).

### 7.6.4 Token invalidation
Stateless JWTs can't be revoked server-side by default. The `User` gained
`passwordChangedAt`; `protect` compares the token's issued-at (`iat`, in seconds) to it
and **rejects any token older than the last password change**. So resetting a password
instantly invalidates every previously-issued session — which is exactly what you want
after a compromise.

> **Password storage internals (context):** passwords are hashed with **bcrypt**. bcrypt
> generates a random **salt** per password and runs a deliberately **slow** key-derivation
> (cost factor = work). The salt defeats precomputed "rainbow table" attacks (identical
> passwords hash differently); the slowness makes brute force expensive. The hash stores
> the salt and cost inside it, so verification re-derives with the same parameters.

### Verification (observed)
An integration suite against Docker MongoDB asserted, end-to-end: weak password → 400;
strong → 201 + token; 5 wrong logins → locked (423 even with the right password);
reset-password → 200; **the pre-reset JWT → 401 after reset (token invalidation)**; login
with the new password → 200; bogus reset token → 400; forgot-password returns 200 for both
known and unknown emails (no enumeration). Result: **9/9 passed.**

---

## 7.7 AI input caps

**Why.** AI endpoints forward user text into LLM prompts. Unbounded text is two risks:
**cost** (LLM billing is per-token, so a huge input is expensive) and **prompt
injection** surface (more attacker-controlled text = more room to manipulate the model).

**How.** The résumé-analysis endpoint now rejects résumé/job-description text over
~20 000 characters before it reaches the model, and the summarizer already capped its
input. Combined with the AI rate limiter, this bounds both the cost and the abuse
surface of every AI call.

---

## 7.8 Atomic slot booking (eliminating a race condition)

### Why it was critical
The old booking did **check-then-write**:
```js
const a = await Availability.findOne({ mentor });   // 1. read
if (a.availableSlots[i].isBooked) return 409;        // 2. check
a.availableSlots[i].isBooked = true; await a.save(); // 3. write
```
Between steps 2 and 3 there is a **race window**. If two mentees book the same slot at
nearly the same moment, **both** read `isBooked:false`, **both** pass the check, and
**both** write `true` — the slot is double-booked. This is a classic *time-of-check to
time-of-use* (TOCTOU) bug, and it only appears under concurrency, so it passes casual
testing.

### How the fix works internally
The fix collapses check-and-write into **one atomic database operation**:
```js
Availability.findOneAndUpdate(
  { mentor, ['availableSlots.' + i + '.isBooked']: false }, // condition is part of the write
  { $set: { ['availableSlots.' + i + '.isBooked']: true } },
  { new: true }
)
```
MongoDB guarantees a write to a **single document** is atomic and isolated. The
condition `isBooked:false` is evaluated **inside** the same operation that performs the
write, so there is no window between them. Under a race, the database serialises the two
operations: the first matches and flips the slot; the second now finds nothing matching
`isBooked:false` and returns `null` — which the handler reports as **409 Already
booked**. Exactly one booking can ever win.

### Verification (observed)
An integration test fired **two bookings of the same slot concurrently**
(`Promise.all([...])`) against Docker MongoDB:
```
concurrent statuses: [200, 409]      → exactly one succeeded
subsequent booking  -> 409           → slot stays claimed
```
Result: **passed** — the race is provably closed.

---

## 7.9 Database indexes & TTL

Covered in depth in Document 04 (§4.5). In short: indexes (B-trees) turn O(n) collection
scans into O(log n) lookups on the fields real queries filter/sort by, and a TTL index on
`Notification` lets MongoDB auto-delete records older than 90 days. All index definitions
were **built and verified against Docker MongoDB** — the test connected, ran
`syncIndexes()` on each model, and printed the resulting indexes to confirm they were
created (compound indexes, the unique email index, and the TTL index all present).

---

## 7.10 How everything was verified (methodology recap)

| Layer | Technique | Example |
|-------|-----------|---------|
| Syntax | `node --check <file>` | every changed server file |
| Pure logic | standalone Node unit script | `gradeMcqRound` / `sanitizeGame` |
| HTTP behaviour | mount the real router on a tiny Express app | auth, ownership, booking |
| Data behaviour | run against **Docker MongoDB** | lockout, reset, indexes, race |
| Concurrency | `Promise.all` of competing requests | double-booking |

**Aggregate test results this week:** auth flows **9/9**, ownership **6/6**, booking
concurrency **passed**, index builds **confirmed**, scoring/sanitizer unit suite
**passed**. Nothing was reported "done" without observing the output of its test.

---

## 7.11 What remains (honest status)

- **Realtime → Redis:** socket state is still per-process; moving it to Redis (to run
  multiple processes) is the next task.
- **AI JSON hardening:** the AI routes still fall back to placeholder data on a parse
  failure instead of validating the LLM's output shape.
- **Pagination rollout:** the helper exists; wiring it into each list endpoint (with the
  matching client "load more") is pending.
- **Coding/GD/HR/live-AI scoring:** these rounds are still client-scored (clamped);
  making them fully server-authoritative needs the sandbox-in-grading and
  persisted-transcript work of later phases.

Each is scoped and sequenced in Document 06.
