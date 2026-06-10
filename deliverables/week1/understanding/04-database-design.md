# 04 — Database Design

This document explains the data layer in depth: **why MongoDB**, **how the documents
relate**, **every collection field-by-field**, the **indexing strategy and how indexes
work internally**, and the **embedding-vs-referencing decisions** behind the schema.

---

## 4.1 Why MongoDB (a document database)

PRISM uses **MongoDB**, a NoSQL document database, accessed through **Mongoose** (an
Object-Data-Mapper, or ODM).

**What that means concretely:** instead of tables and rows with a fixed column layout
(as in MySQL/PostgreSQL), MongoDB stores **collections** of **documents**. A document
is a BSON object (Binary JSON) — essentially a JSON object with types. One `User`
document is one record, and it can contain nested arrays and sub-objects directly.

**Why it fits PRISM:**
1. **The data is naturally document-shaped.** A résumé draft, an interview game with
   its rounds and answers, or a mentor's availability with its slots are all
   self-contained, deeply-nested objects. In SQL these would need 4–5 joined tables;
   in MongoDB each is one document. This keeps reads simple and fast (no joins).
2. **The schema evolves.** It's a student project that will grow. MongoDB lets us add
   a field to a document without a migration that rewrites a whole table.
3. **Mongoose gives us the safety SQL would.** Although MongoDB itself is schemaless,
   Mongoose imposes a **schema** in application code — types, `required`, `enum`,
   `default`, validation — so we get document flexibility *and* structural guarantees.

**The trade-off we accept:** MongoDB does not enforce foreign keys or multi-document
transactions by default. We compensate where it matters (e.g. atomic single-document
updates for booking — see §4.6 and Document 07 §7.8).

### How Mongoose maps to MongoDB
```
JavaScript code         Mongoose                MongoDB
─────────────────       ─────────               ───────────
new User({...})    →  validates vs schema  →  document in `users` collection
User.find(filter)  →  builds a query       →  collection scan or index lookup
ref: 'User'        →  .populate() does a    →  a second query to `users` and merges
                       follow-up lookup
```
A Mongoose `ref` is **not** a database-enforced foreign key — it is a convention that
lets `.populate()` fetch the referenced document in a second query. Referential
integrity is therefore the application's responsibility.

---

## 4.2 Entity Overview

PRISM has **18 collections**. The central entity is **User**; almost everything
references it. The relationships:

```
                                  ┌───────────┐
                  ┌──────────────▶│   User    │◀───────────────┐
                  │               └───────────┘                │
                  │ mentor/mentee   ▲   ▲   ▲ uploadedBy        │ user
                  │                 │   │   │                   │
        ┌─────────┴────────┐        │   │   │        ┌──────────┴─────────┐
        │ MentorshipSession│        │   │   │        │   InterviewGame    │
        └─────────┬────────┘        │   │   │        │  (embeds rounds)   │
                  │ aimingCompany    │   │   │        └────────────────────┘
                  ▼                  │   │   │
            ┌──────────┐   createdBy │   │   │ mentor      ┌──────────────┐
            │ Company  │◀────────────┘   │   └────────────▶│ MockInterview│
            └──────────┘                 │                 └──────┬───────┘
                  ▲ companyTag           │ createdBy              │ mockInterview
                  │                 ┌─────┴────┐                  ▼
            ┌─────┴─────┐  topic    │  Topic   │           ┌─────────────┐
            │ Resource  │──────────▶│          │           │ MockFeedback│
            └─────┬─────┘           └────┬─────┘           └─────────────┘
                  │ resource             │ topic
                  ▼                      ▼
          ┌──────────────┐        ┌──────────────┐
          │ LearningPath │        (also: CodingQuestion, Availability,
          │ (embeds steps)│        QuestionBank, CodeSubmission, Progress,
          └──────────────┘        Notification, ResumeDraft, ResumeAnalysis,
                                   GDRoom)
```

**Two structural patterns are used deliberately:**
- **Referencing** (`ObjectId` + `ref`) for entities that have their own lifecycle and
  are shared (User, Topic, Company, Resource).
- **Embedding** (nested sub-documents) for data that only exists inside its parent and
  is always read with it (a session's rounds, a résumé's education list, an
  availability's slots).

§4.6 explains *why* each choice was made.

---

## 4.3 Collections — field by field

> Legend: 🔑 = referenced foreign key (`ObjectId`), 🧩 = embedded sub-document array,
> 🔒 = security-sensitive field.

### A. Identity

#### `User` — the central entity
| Field | Type | Notes |
|-------|------|-------|
| `name`, `email`, `password` 🔒 | String | `email` unique; `password` is a **bcrypt hash**, never plaintext |
| `role` | enum `mentor\|mentee\|admin` | Drives every authorization decision |
| `bio`, `skills[]`, `expertise[]` | String/Array | Profile content |
| `aimingCompany`, `currentCompany`, `experienceLevel`, `experience`, `college`, `graduationYear`, `linkedin`, `github` | mixed | Profile metadata |
| `isOnline` | Boolean | Flipped by the realtime presence system |
| `profilePicture`, `resumeUrl` | String | Asset URLs |
| `rating`, `totalReviews` | Number | Mentor's running average rating |
| `failedLoginAttempts`, `lockUntil` 🔒 | Number/Date | **Brute-force lockout** (Week 1) |
| `passwordChangedAt` 🔒 | Date | **Token invalidation** — JWTs issued before this are rejected (Week 1) |
| `resetPasswordToken`, `resetPasswordExpire` 🔒 | String/Date | **Password reset** — stores a *hash* of the reset token (Week 1) |
| `createdAt` | Date | |

> **Security note:** `password` is selected out of most responses, and the reset token
> is stored hashed so that even a database leak cannot be used to take over accounts.
> Full reasoning in Document 07, §7.6.

### B. Mentorship

#### `MentorshipSession`
| Field | Type | Notes |
|-------|------|-------|
| `mentor` 🔑, `mentee` 🔑 | User | The two participants |
| `aimingCompany` 🔑 | Company | Optional context |
| `agenda` | String | What the session is about |
| `scheduledDate` | Date | When |
| `duration` | Number | Minutes |
| `meetingLink` | String | Video room link |
| `status` | enum | `pending → approved/rejected → in-progress → completed/cancelled` |
| `mentorFeedback`, `menteeFeedback` | String | Post-session notes |
| `ratingGiven` | Number | Guards against double-rating |
| `createdAt` | Date | |

#### `Availability`
| Field | Type | Notes |
|-------|------|-------|
| `mentor` 🔑 | User | Owner of these slots |
| `weeklySlots` 🧩 | `[{day, startTime, endTime, isAvailable}]` | Recurring weekly template |
| `availableSlots` 🧩 | `[{date, startTime, endTime, isBooked, bookedBy🔑}]` | Concrete bookable slots |
| `timezone` | String | Default `Asia/Kolkata` |

> The booking operation flips `availableSlots[i].isBooked`. This is done with an
> **atomic conditional update** to prevent two mentees grabbing the same slot — see §4.6.

### C. 1:many Teaching

#### `MockInterview`
| Field | Type | Notes |
|-------|------|-------|
| `type` | enum `technical\|hr\|gd` | Kind of session |
| `mentor` 🔑, `participants[]` 🔑 | User | Host + attendees |
| `companyFocus` 🔑, `topic` 🔑 | Company/Topic | Context |
| `scheduledDate`, `duration`, `meetingLink` | — | Logistics |
| `status` | enum `scheduled\|ongoing\|completed\|cancelled` | Lifecycle |

#### `MockFeedback`
| Field | Type | Notes |
|-------|------|-------|
| `mockInterview` 🔑, `user` 🔑 | refs | Which session, which mentee |
| `communicationScore`, `technicalScore`, `confidenceScore`, `problemSolvingScore`, `overallScore` | Number | The rubric |
| `strengths`, `weaknesses`, `suggestions` | String | Qualitative feedback |

#### `GDRoom`
| Field | Type | Notes |
|-------|------|-------|
| `participants[]` 🔑 | User | Up to `maxParticipants` (default 6) |
| `status` | enum `waiting\|active\|completed` | Lifecycle |
| `gdTopic` | String | The discussion prompt |

### D. Solo Practice

#### `InterviewGame` — embeds the entire game
| Field | Type | Notes |
|-------|------|-------|
| `user` 🔑 | User | The player |
| `rounds` 🧩 | `[roundSchema]` | The 6 rounds, embedded (see below) |
| `currentRound`, `totalScore`, `maxTotalScore` | Number | Progress + score |
| `status` | enum `in-progress\|completed\|abandoned` | |
| `difficulty`, `companyFocus`🔑 | — | Config |
| `startedAt`, `completedAt` | Date | |

**Embedded `roundSchema`:**
| Field | Type | Notes |
|-------|------|-------|
| `type` | enum `aptitude\|technical1\|coding\|gd\|technical2\|hr` | Which round |
| `score`, `maxScore` | Number | Result |
| `answers` 🧩 | `[{questionId, selectedAnswer, isCorrect, timeTaken}]` | What the user submitted |
| `servedQuestions` 🧩 🔒 | `[{questionId, ans}]` | **The answer key** the server stored when it served the round. **Never sent to the client** — stripped by `sanitizeGame()`. Added in Week 1 to make scoring server-authoritative. |
| `status`, `feedback`, `completedAt` | — | |

#### `QuestionBank` — curated questions (one model, multiple shapes)
Holds aptitude/technical **MCQs** (`q`, `opts[]`, `ans`, `explanation`), **HR** prompts
(reuses `q`), and **coding** problems (`title`, `description`, `examples[]`,
`testCases[]`, `boilerplate{js,python,cpp,java,c}`). A `verified` flag marks
mentor-approved questions; `type` + `difficulty` are indexed.

#### `CodingQuestion`
A standalone coding-question model (`title`, `description`, `difficulty`, `topic`🔑,
`companyTags[]`🔑, `sampleInput/Output`). *Design note (for later phases):* this
overlaps with `QuestionBank`'s coding shape — consolidating the two into one source of
truth is a recommended Phase-2/3 cleanup.

#### `CodeSubmission`
Records a code run inside a mock interview: `mockInterview`🔑, `question`🔑, `user`🔑,
`code`, `language`, `output`, `error`, `score`, `submittedAt`.

### E. Résumé

#### `ResumeDraft` — a full structured résumé (heavily embedded)
`user`🔑, `name`, `template`, and embedded sub-objects: `personalInfo{...}`,
`education[]`, `experience[]`, `skills[]`, `projects[]`, `certifications[]`,
`coverLetter{...}`, plus `jobDescription`, `lastGenerated`, `createdAt`, `updatedAt`.
A Mongoose **`pre('save')` hook** auto-updates `updatedAt` on every save.

#### `ResumeAnalysis`
`user`🔑, `resumeUrl`, `jobDescription`, `matchScore`, `missingKeywords[]`,
`suggestions`, `redFlags[]`, `starSuggestions[]` — the AI ATS-analysis result.

### F. Content & Learning

#### `Topic`, `Company`
`Topic`: `name`, `description`, `createdBy`🔑. `Company`: `name` (unique),
`description`, `interviewPattern`, `difficultyLevel`. These are the tagging dimensions
for resources and questions.

#### `Resource`
`title`, `description`, `topic`🔑, `level` (enum), `resourceType`
(video/article/pdf/link), `link`, `fileUrl`, `uploadedBy`🔑, `companyTag`🔑. The
`uploadedBy` field is what the Week 1 ownership checks use to ensure only the uploader
(or an admin) can edit/delete it.

#### `LearningPath` — embeds ordered steps
`user`🔑, `topic`🔑, `title`, `level`, `steps[]` 🧩 (each step:
`order, title, description, resource🔑, estimatedTime, completed, completedAt`),
`totalSteps`, `completedSteps`, `progress`, `aiGenerated`.

### G. Progress & Notifications

#### `Progress`
`mentee`🔑, `completedResources[]`🔑, `mockInterviewStats{technical/hr/gd avg}`,
`topicProgress[]` 🧩 (`{topic🔑, percentage}`).

#### `Notification`
`user`🔑, `message`, `type` (enum), `isRead`, `link`, `createdAt`. Has a **TTL index**
(see §4.5) that auto-deletes notifications after 90 days.

---

## 4.4 Embedding vs. Referencing — the decisions

This is the single most important schema-design choice in a document database. The
rule of thumb used: **embed data that is owned by and always read with its parent;
reference data that has its own identity and is shared.**

| Data | Decision | Why |
|------|----------|-----|
| Interview-game `rounds` | **Embed** | A round has no meaning outside its game and is always loaded with it. Embedding = one read, no joins. |
| Résumé `education/experience/...` | **Embed** | They *are* the résumé; never queried independently. |
| Availability `slots` | **Embed** | Belong entirely to one mentor's availability document; updated together. |
| Learning-path `steps` | **Embed** | Ordered list owned by the path. |
| `mentor` / `mentee` on a session | **Reference** | Users are shared, have their own lifecycle, and are huge — embedding would duplicate user data into every session. |
| `topic` / `company` on a resource | **Reference** | Shared tagging dimensions used across many resources. |

**The cost of embedding** is that you can't easily query the embedded items across
parents (e.g. "all rounds of type coding across all games" requires aggregation).
That's an acceptable trade because PRISM never needs those cross-cutting queries on
embedded data — it reads them per-parent.

---

## 4.5 Indexing Strategy (and how an index actually works)

### What an index is, internally
Without an index, answering `find({ user: X })` forces MongoDB to read **every
document** in the collection and test each one — an **O(n) collection scan**. At a few
hundred users that's fine; at tens of thousands of notifications it is slow and
CPU-hungry.

An index is a separate, sorted data structure — MongoDB uses a **B-tree** — that maps
field values to the documents that hold them. A B-tree keeps keys sorted and balanced,
so a lookup is **O(log n)**: the database walks down the tree (a handful of comparisons)
instead of scanning everything. A **compound index** like `{user: 1, createdAt: -1}`
sorts first by user, then by time descending — which exactly matches the query "this
user's notifications, newest first," so MongoDB can both *filter* and *return them
already sorted* without a separate in-memory sort.

The trade-off: each index costs disk space and makes writes slightly slower (the tree
must be updated on insert/update). So we index **only the fields real queries filter or
sort on**, not everything.

### Indexes added (Week 1)
| Collection | Index | Serves the query… |
|------------|-------|-------------------|
| `User` | `email` (unique) | login by email; uniqueness guarantee |
| `User` | `role` | filtering users by role |
| `User` | `resetPasswordToken` | reset-token lookup |
| `MentorshipSession` | `{mentor, status}`, `{mentee, status}` | "my sessions, filtered by status" |
| `MentorshipSession` | `{scheduledDate: -1}` | newest-first sort |
| `Notification` | `{user, createdAt: -1}` | "my notifications, newest first" |
| `Notification` | `{user, isRead}` | unread count |
| `Resource` | `{topic, level}`, `uploadedBy`, `{createdAt:-1}` | filtered browse + sort |
| `InterviewGame` | `{user, startedAt:-1}` | game history |
| `InterviewGame` | `{status, totalScore:-1}` | leaderboard |
| `MockInterview` | `{status, scheduledDate:-1}`, `mentor` | listing/filtering |
| `Progress` | `mentee` | per-mentee lookup |
| `QuestionBank` | `{type, difficulty}` | question sampling |

### The TTL index (a special, time-based index)
`Notification` has:
```js
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
```
A **TTL (time-to-live) index** is an ordinary index on a Date field plus a rule that
MongoDB's background thread will **delete** any document once `createdAt` is older than
the threshold (90 days here). This keeps the notifications collection from growing
without bound — the database does the housekeeping itself, with no cron job.

---

## 4.6 Atomicity & Integrity (no double-booking)

MongoDB guarantees that a write to a **single document** is atomic. PRISM uses this to
make slot booking safe under concurrency. Instead of "read the slot, check it's free,
then save it booked" (which has a race window where two users both see it free), the
booking is a **single conditional update**:

```js
Availability.findOneAndUpdate(
  { mentor, ['availableSlots.' + i + '.isBooked']: false },  // only if still free
  { $set: { ['availableSlots.' + i + '.isBooked']: true } }, // claim it
  { new: true }
)
```
The filter and the write happen as one atomic operation in the database engine. If two
requests race, exactly one matches `isBooked: false` and succeeds; the other matches
nothing and is told "already booked." The full reasoning and the concurrency test are
in Document 07, §7.8.

---

## 4.7 Summary of design principles

1. **Document-shaped data → embed; shared entities → reference.**
2. **Index the fields real queries touch; nothing else.**
3. **Let the database enforce what it can** (unique email, atomic single-doc writes,
   TTL cleanup) and **enforce the rest in the application** (ownership, referential
   integrity).
4. **Security-sensitive fields are deliberately shaped** — passwords hashed, reset
   tokens hashed, answer keys (`servedQuestions`) never serialized to the client.
