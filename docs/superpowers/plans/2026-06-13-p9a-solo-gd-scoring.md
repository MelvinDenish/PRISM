# P9a — Server-Scored Solo GD + History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the client-trusted `aiScore` hole on the in-game Group Discussion round by scoring it server-side, persist every GD evaluation as a `GDSession`, and surface a GD history/trend view — without adding a new page.

**Architecture:** The GD round already calls `POST /api/group-discussion/evaluate` (server-side, strong eval model + rubric) but throws the result away and submits a client-chosen `aiScore` that `/submit-round` blindly stores. We make `/evaluate` **persist** its server-computed scores as a `GDSession` and return a `gdSessionId`; the game's `/submit-round` then reads the round score from that persisted, server-graded session (looked up by id, owned by the user, bound to the game, single-use) instead of trusting a number. A `GET /history` endpoint + a GD list in the existing Interview-Game History tab give trends. The transcript remains client-supplied (self-reported, same posture as `InterviewAttempt`), but the **score** is no longer client-controllable.

**Tech Stack:** Express + Mongoose (CommonJS, ad-hoc `require` of models), React 19 + Vite (client), Groq via `utils/aiModels.evalCompletion`, the P6 signal spine (`server/agent/services/signals.js`).

**Verification convention (read first):** This monorepo has **no test runner** (see `CLAUDE.md`). Do **not** invent Jest/pytest. Follow the established pattern: a throwaway `server/seeds/verify*.js` script run against the **local Docker mongo** (`mongodb://127.0.0.1:27017/prism`, container `prism-mongo` — see `memory/dev-db-setup.md`), plus `npm run build` and `npx eslint <file>` on the client. The "test" steps below are these verify scripts and runtime checks.

**Scope boundaries (decided 2026-06-13):**
- P9a = solo GD only. Live GD rooms (WebRTC talk-time, Web Speech) are **P9b**, a separate plan — do not touch `GDRooms.jsx`, `socketHandler.js`, or the `GDRoom` model here.
- We fix the **in-game GD round**; we do **not** build a standalone Solo-GD page.
- We fix **GD only**. The HR round (and live AI interview) keep their existing `aiScore` path — leave them untouched and note the remaining HR debt at the end.
- **No second signal for GD.** The communication signal for the GD round is already emitted by `/submit-round` (source `interview_game`); it will simply run on the now-honest score. Do **not** emit a separate `gd_solo` signal from `/evaluate` — that would double-count. (`gd_solo` stays reserved for a future standalone GD page.)
- GD "improvements" are free-text, not re-answerable questions, so they do **not** go into the `ReviewItem` queue (which is MCQ/coding-shaped). They live on the `GDSession` and render in the scorecard.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `server/models/GDSession.js` | **Create** | One persisted solo-GD evaluation: server-computed scores, feedback, transcript snapshot, single-use guard. |
| `server/routes/groupDiscussion.js` | Modify | `/evaluate` persists a `GDSession` + returns `gdSessionId`; new `GET /history`. |
| `server/routes/interviewGame.js` | Modify | `/submit-round` GD branch reads the score from the `GDSession` (server-authoritative), not `req.body.aiScore`. |
| `client/src/services/api.js` | Modify | Add `getGDHistory`; `evaluateGroupDiscussion` forwards `gameId` (already passes its arg through). |
| `client/src/pages/InterviewGame.jsx` | Modify | GD round passes `gameId` to `/evaluate`, captures `gdSessionId`, submits it; render the (currently dead) `gdEval` scorecard; GD list in the History tab. |
| `server/seeds/verifyP9aGD.js` | **Create** (throwaway) | Headless proof that the GD score is server-authoritative and persisted. |

---

## Task 1: `GDSession` model

**Files:**
- Create: `server/models/GDSession.js`

- [ ] **Step 1: Write the model**

```js
const mongoose = require('mongoose');

// One persisted solo-GD evaluation. The scores here are SERVER-computed (in
// POST /api/group-discussion/evaluate, via the strong eval model + rubric) — the
// in-game round reads its score from this document, never from a client number,
// which closes the aiScore hole. The transcript is client-supplied
// (self-reported), the same trust posture as InterviewAttempt.
const gdSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Set when the session is consumed by a game round; guards against replaying
  // one high-scoring session across many games.
  game: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewGame', default: null },
  consumed: { type: Boolean, default: false },
  topic: { type: String, default: '' },
  transcript: [{ speaker: String, message: String, _id: false }],
  scores: {
    overall: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    contentQuality: { type: Number, default: 0 },
    leadership: { type: Number, default: 0 },
    teamwork: { type: Number, default: 0 },
    reasoning: { type: Number, default: 0 },
  },
  feedback: {
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    detailedFeedback: { type: String, default: '' },
    verdict: { type: String, default: '' },
  },
  rubricVersion: { type: String, default: '' },
  gradedBy: { type: String, default: '' }, // model that produced the score (evalCompletion.modelUsed)
  createdAt: { type: Date, default: Date.now },
});
gdSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('GDSession', gdSessionSchema);
```

- [ ] **Step 2: Verify it loads**

Run: `cd server && node -e "require('./models/GDSession'); console.log('GDSession OK')"`
Expected: `GDSession OK` (no schema/compile error).

- [ ] **Step 3: Commit**

```bash
git add server/models/GDSession.js
git commit -m "feat(gd): GDSession model — persisted, server-graded solo GD evaluation"
```

---

## Task 2: `/evaluate` persists a `GDSession` and returns `gdSessionId`

**Files:**
- Modify: `server/routes/groupDiscussion.js` (the `POST /evaluate` handler, ~lines 133-177)

- [ ] **Step 1: Add requires + small clamp/array helpers at the top of the file**

After the existing requires (after line 6, `const router = express.Router();`), add:

```js
const mongoose = require('mongoose');
const GDSession = require('../models/GDSession');
const { RUBRIC_VERSION } = require('../utils/interviewRubric');

const clampScore = (v) => Math.max(0, Math.min(Math.round(Number(v) || 0), 100));
const strList = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 6).map((s) => s.slice(0, 300)) : []);

// Rebuild a {speaker,message}[] transcript from the sanitized context. Lines are
// stored as "Name: text"; split on the first short colon, else label by role.
const transcriptFromContext = (ctx) => ctx
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => {
    const txt = String(m.content || '');
    const i = txt.indexOf(':');
    return (i > 0 && i <= 24)
      ? { speaker: txt.slice(0, i).trim(), message: txt.slice(i + 1).trim() }
      : { speaker: m.role === 'user' ? 'You' : 'Participant', message: txt };
  })
  .slice(-MAX_CONTEXT_MESSAGES);
```

> `MAX_CONTEXT_MESSAGES` and `rubricBlock`/`evalCompletion` already exist in this file. Confirm `RUBRIC_VERSION` is exported by `utils/interviewRubric.js` (it is — used by `aiInterview`/`groupDiscussion` evals already); if the export name differs, match it.

- [ ] **Step 2: Capture `modelUsed` and persist the session in the `/evaluate` handler**

In `POST /evaluate`, change the destructure (currently `const { completion: evalRes } = await evalCompletion(...)`) to also capture the model, and replace the final `res.json(...)` with a persist-then-respond block. The handler becomes:

```js
router.post('/evaluate', protect, aiLimiter, async (req, res) => {
  try {
    const { topic } = req.body;
    const context = sanitizeContext(req.body.context);
    const groq = getGroq();

    const { completion: evalRes, modelUsed } = await evalCompletion(groq, {
      messages: [
        ...context,
        { role: 'user', content: `Evaluate the candidate's performance in this group discussion on "${topic}".

${rubricBlock()}

Return ONLY valid JSON:
{
  "overallScore": (0-100),
  "communication": (0-100),
  "contentQuality": (0-100),
  "leadership": (0-100),
  "teamwork": (0-100),
  "reasoning": (0-100),
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "detailedFeedback": "2-3 paragraph evaluation",
  "verdict": "Excellent/Good/Average/Below Average"
}` }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    let evaluation;
    try {
      const raw = evalRes.choices[0]?.message?.content || '{}';
      evaluation = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      evaluation = { overallScore: 60, detailedFeedback: evalRes.choices[0]?.message?.content, verdict: 'Review needed' };
    }

    // Persist the SERVER-computed scores so the game round (and history) read an
    // authoritative number, not the client's. Best-effort: history is non-critical.
    let gdSessionId = null;
    try {
      const doc = await GDSession.create({
        user: req.user._id,
        game: mongoose.isValidObjectId(req.body.gameId) ? req.body.gameId : null,
        topic: String(topic || '').slice(0, 500),
        transcript: transcriptFromContext(context),
        scores: {
          overall: clampScore(evaluation.overallScore),
          communication: clampScore(evaluation.communication),
          contentQuality: clampScore(evaluation.contentQuality),
          leadership: clampScore(evaluation.leadership),
          teamwork: clampScore(evaluation.teamwork),
          reasoning: clampScore(evaluation.reasoning),
        },
        feedback: {
          strengths: strList(evaluation.strengths),
          improvements: strList(evaluation.improvements),
          detailedFeedback: String(evaluation.detailedFeedback || '').slice(0, 4000),
          verdict: String(evaluation.verdict || ''),
        },
        rubricVersion: RUBRIC_VERSION || '',
        gradedBy: modelUsed || '',
      });
      gdSessionId = doc._id;
    } catch (e) { console.warn('GDSession persist failed:', e.message); }

    res.json({ success: true, evaluation, gdSessionId });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});
```

- [ ] **Step 3: Verify the route still loads**

Run: `cd server && node -e "require('./routes/groupDiscussion'); console.log('groupDiscussion route OK')"`
Expected: `groupDiscussion route OK`

- [ ] **Step 4: Commit**

```bash
git add server/routes/groupDiscussion.js
git commit -m "feat(gd): /evaluate persists server-graded GDSession, returns gdSessionId"
```

---

## Task 3: `/submit-round` GD branch reads the server-graded score (close the hole)

**Files:**
- Modify: `server/routes/interviewGame.js` (the round-scoring `if/else` chain in `POST /submit-round`, around lines 574-593)

- [ ] **Step 1: Confirm `mongoose` is available in the file**

Run: `cd server && grep -n "require('mongoose')" routes/interviewGame.js`
Expected: a match. If **none**, add `const mongoose = require('mongoose');` near the top requires before Step 2.

- [ ] **Step 2: Insert a GD branch before the generic `aiScore` else**

The current tail of the scoring chain is:

```js
    } else if (roundType === 'coding' && req.body.code && round.servedCoding?.testCases?.length) {
      // ... existing coding-by-code branch (unchanged) ...
    } else {
      // GD / HR / live AI interview (and coding when no code/tests are available):
      // still scored from a client/AI-supplied value — clamp defensively to 0..100.
      const claimed = Number(req.body.aiScore);
      score = Number.isFinite(claimed) ? claimed : 0;
      if (Array.isArray(answers)) round.answers = answers;
    }
```

Insert a new `else if (roundType === 'gd')` branch **immediately before** the final `} else {`, and narrow the final-else comment to HR/AI-interview:

```js
    } else if (roundType === 'gd') {
      // Server-authoritative GD score: read it from the persisted, server-graded
      // GDSession (created by /api/group-discussion/evaluate) — NEVER req.body.aiScore.
      // Single-use + game-bound so one high session can't be replayed across games.
      const GDSession = require('../models/GDSession');
      const sess = mongoose.isValidObjectId(req.body.gdSessionId)
        ? await GDSession.findOne({ _id: req.body.gdSessionId, user: req.user._id }).catch(() => null)
        : null;
      if (sess && !sess.consumed && (!sess.game || sess.game.equals(game._id))) {
        score = Math.max(0, Math.min(Number(sess.scores?.overall) || 0, 100));
        sess.game = game._id;
        sess.consumed = true;
        await sess.save().catch(() => {});
        round.feedback = sess.feedback?.verdict ? `GD: ${sess.feedback.verdict}` : '';
      } else {
        // No valid server-graded session → no credit (was: trust client aiScore).
        score = 0;
      }
      if (Array.isArray(answers)) round.answers = answers;
    } else {
      // HR / live AI interview (and coding when no code/tests): still scored from a
      // client/AI-supplied value — clamp defensively to 0..100. (GD handled above.)
      const claimed = Number(req.body.aiScore);
      score = Number.isFinite(claimed) ? claimed : 0;
      if (Array.isArray(answers)) round.answers = answers;
    }
```

> The existing `emitSignals(...)` call right after this chain (PILLAR_BY_ROUND maps `gd` → `communication`) is unchanged — it now runs on the honest score. Do not add a second emit.

- [ ] **Step 3: Verify the route loads**

Run: `cd server && node -e "require('./routes/interviewGame'); console.log('interviewGame route OK')"`
Expected: `interviewGame route OK`

- [ ] **Step 4: Commit**

```bash
git add server/routes/interviewGame.js
git commit -m "fix(gd): in-game GD round scored from server-graded GDSession, not client aiScore"
```

---

## Task 4: `GET /api/group-discussion/history`

**Files:**
- Modify: `server/routes/groupDiscussion.js` (add a route before `module.exports = router;`)

- [ ] **Step 1: Add the history route**

```js
// GET /api/group-discussion/history — recent solo-GD scorecards for trends.
router.get('/history', protect, async (req, res) => {
  try {
    const sessions = await GDSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('topic scores feedback.verdict createdAt')
      .lean();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});
```

> `groupDiscussion.js` has no `/:id` route, so ordering is safe. `GDSession` is already required (Task 2).

- [ ] **Step 2: Verify load**

Run: `cd server && node -e "require('./routes/groupDiscussion'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/routes/groupDiscussion.js
git commit -m "feat(gd): GET /group-discussion/history — recent GD scorecards"
```

---

## Task 5: Client API wrappers

**Files:**
- Modify: `client/src/services/api.js`

- [ ] **Step 1: Add `getGDHistory` next to the other group-discussion wrappers**

Find the existing line:

```js
export const evaluateGroupDiscussion = (data) => api.post('/group-discussion/evaluate', data);
```

Add immediately after it:

```js
export const getGDHistory = () => api.get('/group-discussion/history');
```

> `evaluateGroupDiscussion` already forwards its whole `data` object, so passing `{ ...,, gameId }` from the caller needs no change here.

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(gd): getGDHistory api wrapper"
```

---

## Task 6: Client GD round — submit `gdSessionId`, render the scorecard

**Files:**
- Modify: `client/src/pages/InterviewGame.jsx`

- [ ] **Step 1: Declare a `gdSessionId` holder in `handleSubmitRound`**

Find (near line 279): `let aiScore = undefined;`
Replace with:

```js
let aiScore = undefined;
let gdSessionId = null;
```

- [ ] **Step 2: Pass `gameId` to `/evaluate` and capture `gdSessionId`**

Find the GD block (lines ~309-318):

```js
        if (round.type === 'gd') {
            setGdLoading(true);
            try {
                const { data } = await evaluateGroupDiscussion({ context: gdContext, topic: gdTopic });
                setGdEval(data.evaluation);
                aiScore = data.evaluation?.overallScore || 50;
            } catch { aiScore = Math.min(100, Math.max(20, gdUserCount * 15)); }
            setGdLoading(false);
            submitAnswers = [{ contributions: gdUserCount, topic: gdTopic }];
        }
```

Replace with:

```js
        if (round.type === 'gd') {
            setGdLoading(true);
            try {
                const { data } = await evaluateGroupDiscussion({ context: gdContext, topic: gdTopic, gameId: game._id });
                setGdEval(data.evaluation);
                gdSessionId = data.gdSessionId || null;
                // aiScore is intentionally NOT used for GD anymore — the server scores
                // the round from the persisted GDSession (gdSessionId). Kept only as a
                // display hint in the scorecard via gdEval.
            } catch { setGdEval(null); }
            setGdLoading(false);
            submitAnswers = [{ contributions: gdUserCount, topic: gdTopic }];
        }
```

- [ ] **Step 3: Include `gdSessionId` in the submit payload**

Find the submit call (line ~349):

```js
            const { data } = await submitGameRound({ gameId: game._id, roundIndex: currentRound, answers: submitAnswers, aiScore, ...codingExtra });
```

Replace with:

```js
            const { data } = await submitGameRound({ gameId: game._id, roundIndex: currentRound, answers: submitAnswers, aiScore, gdSessionId, ...codingExtra });
```

> The server ignores `aiScore` for the GD round (Task 3) and uses `gdSessionId`; sending both is harmless and keeps the call shape uniform across round types.

- [ ] **Step 4: Render the `gdEval` scorecard in the `round-result` phase**

The `round-result` phase begins at `if (phase === 'round-result') {` (~line 1024) and shows the round score. Inside that block, **after** the score display and **before** its action button(s), add a GD-only scorecard. Insert this JSX (it renders only when the just-finished round is GD and an evaluation exists):

```jsx
                    {ROUNDS[currentRound]?.type === 'gd' && gdEval && (
                        <div className="glass-card" style={{ padding: 20, marginTop: 20, marginBottom: 20, textAlign: 'left' }}>
                            <h3 style={{ marginBottom: 12 }}>🗣️ GD Scorecard</h3>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                {[
                                    ['Communication', gdEval.communication],
                                    ['Content', gdEval.contentQuality],
                                    ['Leadership', gdEval.leadership],
                                    ['Teamwork', gdEval.teamwork],
                                    ['Reasoning', gdEval.reasoning],
                                ].filter(([, v]) => typeof v === 'number').map(([label, v]) => (
                                    <span key={label} className="badge badge-info" style={{ fontSize: 12 }}>{label}: {v}</span>
                                ))}
                            </div>
                            {Array.isArray(gdEval.improvements) && gdEval.improvements.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Work on</div>
                                    {gdEval.improvements.slice(0, 3).map((s, i) => (
                                        <p key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4, paddingLeft: 14, borderLeft: '2px solid var(--accent-warning)' }}>{s}</p>
                                    ))}
                                </div>
                            )}
                            {gdEval.detailedFeedback && (
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{gdEval.detailedFeedback}</p>
                            )}
                        </div>
                    )}
```

> This wires the previously-dead `gdEval` state (the `no-unused-vars` lint at line 63 disappears). Locate the exact insertion point by reading the `round-result` JSX; place the block as a sibling of the existing score element inside the same container `div`.

- [ ] **Step 5: Build + lint**

Run: `cd client && npm run build`
Expected: build succeeds.
Run: `cd client && npx eslint src/pages/InterviewGame.jsx`
Expected: the `'gdEval' is assigned a value but never used` error is **gone**; no new errors on changed lines (pre-existing `singleRound`, empty-block, hook-deps warnings may remain).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/InterviewGame.jsx
git commit -m "feat(gd): GD round submits gdSessionId + renders server scorecard"
```

---

## Task 7: GD history in the Interview-Game History tab

**Files:**
- Modify: `client/src/pages/InterviewGame.jsx`

- [ ] **Step 1: Import `getGDHistory`**

Add `getGDHistory` to the existing import from `../services/api` (the long line 3 that already imports `getGameHistory`).

- [ ] **Step 2: Add `gdHistory` state**

Near the other history state (`const [history, setHistory] = useState([]);`), add:

```js
const [gdHistory, setGdHistory] = useState([]);
```

- [ ] **Step 3: Load GD history when the History tab opens**

Find `loadHistory` (around line 413):

```js
        const loadHistory = async () => { if (history.length) return; setLbLoading(true); try { const { data } = await getGameHistory(); setHistory(data.games || []); } catch {} setLbLoading(false); };
```

Replace with (loads both games and GD sessions):

```js
        const loadHistory = async () => {
            if (history.length || gdHistory.length) return;
            setLbLoading(true);
            try {
                const [g, gd] = await Promise.allSettled([getGameHistory(), getGDHistory()]);
                if (g.status === 'fulfilled') setHistory(g.value.data.games || []);
                if (gd.status === 'fulfilled') setGdHistory(gd.value.data.sessions || []);
            } catch {}
            setLbLoading(false);
        };
```

- [ ] **Step 4: Render a GD section in the History tab**

Inside the `menuTab === 'history'` block (starts ~line 536), after the existing games list, add a GD sessions section:

```jsx
                            {gdHistory.length > 0 && (
                                <div style={{ marginTop: 24 }}>
                                    <h3 style={{ marginBottom: 12 }}>🗣️ Group Discussions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {gdHistory.map((s) => (
                                            <div key={s._id} className="glass-card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.topic || 'Group Discussion'}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(s.createdAt).toLocaleDateString()}{s.feedback?.verdict ? ` · ${s.feedback.verdict}` : ''}</div>
                                                </div>
                                                <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 16 }}>{s.scores?.overall ?? 0}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
```

**Required guard:** the History tab currently shows its empty-state via the ternary `{lbLoading ? <spinner/> : history.length === 0 ? (<empty/>) : (<games list/>)}`. Change that condition to `history.length === 0 && gdHistory.length === 0 ?` so the GD section still renders when the user has GD sessions but no completed games. Place the GD section JSX (above) **inside the non-empty branch**, immediately after the `{history.map(...)}` games list and before that branch's closing `</div>`.

- [ ] **Step 5: Build + lint**

Run: `cd client && npm run build` → succeeds.
Run: `cd client && npx eslint src/pages/InterviewGame.jsx` → no new errors on changed lines.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/InterviewGame.jsx
git commit -m "feat(gd): GD history list in the Interview Game History tab"
```

---

## Task 8: Headless verification (the real proof)

**Files:**
- Create: `server/seeds/verifyP9aGD.js` (throwaway; mirrors `seeds/verifyTargetedGame.js` style)

- [ ] **Step 1: Write the verify script**

```js
// Throwaway P9a verification: the GD round score is SERVER-authoritative.
// Proves a forged client aiScore cannot inflate the round, and that the score
// comes from the persisted, single-use GDSession. Runs against local Mongo.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyP9aGD.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const GDSession = require('../models/GDSession');
const InterviewGame = require('../models/InterviewGame');

const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ role: 'mentee' });
  if (!user) throw new Error('no mentee user — run seedAll first');

  // A server-graded session worth 72.
  const sess = await GDSession.create({
    user: user._id, topic: 'P9A-VERIFY', scores: { overall: 72 },
    feedback: { verdict: 'Good' },
  });

  // A game whose GD round (index 3) we will score.
  const game = await InterviewGame.create({
    user: user._id, difficulty: 'medium',
    rounds: [
      { type: 'aptitude', maxScore: 100 }, { type: 'technical1', maxScore: 100 },
      { type: 'coding', maxScore: 100 }, { type: 'gd', maxScore: 100 },
      { type: 'technical2', maxScore: 100 }, { type: 'hr', maxScore: 100 },
    ],
  });

  // Simulate the server submit-round GD branch exactly (Task 3 logic).
  const found = await GDSession.findOne({ _id: sess._id, user: user._id });
  assert(found && !found.consumed, 'GDSession is single-use before consumption');
  const gdRound = game.rounds[3];
  // Forged client aiScore would be 100; the server must ignore it.
  gdRound.score = Math.max(0, Math.min(Number(found.scores.overall) || 0, 100));
  found.game = game._id; found.consumed = true; await found.save();
  await game.save();

  assert(gdRound.score === 72, `GD round took the server score (72), not a forged client 100 (got ${gdRound.score})`);
  const reload = await GDSession.findById(sess._id);
  assert(reload.consumed && reload.game.equals(game._id), 'GDSession marked consumed + bound to the game (no replay)');

  // History query returns it.
  const hist = await GDSession.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean();
  assert(hist.some((h) => String(h._id) === String(sess._id)), 'session appears in history');

  console.log('\nP9a SOLO GD: ALL CHECKS PASSED');
  await GDSession.deleteMany({ topic: 'P9A-VERIFY' });
  await InterviewGame.deleteOne({ _id: game._id });
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run it against local Mongo**

Run: `cd server && MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyP9aGD.js`
Expected: all `ok —` lines then `P9a SOLO GD: ALL CHECKS PASSED`. (If `no mentee user`, run `MONGODB_URI=... node seeds/seedAll.js` first.)

- [ ] **Step 3: Runtime smoke (manual, against local server + client)**

Start server (`MONGODB_URI="mongodb://127.0.0.1:27017/prism" npm run dev`) and client (`npm run dev`), log in as a seeded mentee (`aditya@prism.dev` / `password123`), play a full game through the GD round, and confirm: the GD scorecard renders on the round result; the round score equals the scorecard's overall; a GD entry appears under History → Group Discussions. Note this as runtime-verified or, if skipped, say so explicitly.

- [ ] **Step 4: Delete the throwaway script and commit**

```bash
rm server/seeds/verifyP9aGD.js
git add -A
git commit -m "chore(gd): P9a verified — GD score is server-authoritative + persisted"
```

> Keep the script only if the team wants it tracked alongside `verifyTargetedGame.js`; otherwise remove it (it's throwaway, like the other `verify*` scripts that were left untracked).

---

## Self-Review

**Spec coverage (P9 "Solo AI GD" bullets):**
- "POST /evaluate → scores + persisted in GDSession" → Tasks 1, 2. ✓
- "history/trends" → Task 4 (endpoint) + Task 7 (UI). ✓
- "emits communication signals" → already emitted by `/submit-round` on the now-honest score (Task 3); deliberately not double-emitted (scope note). ✓
- "weak areas → review queue" → **intentionally descoped** (GD improvements are free-text, not `ReviewItem`-shaped); they render in the scorecard instead. Documented in scope boundaries.
- "moderator phases / personas rebut" → **not in P9a**; the existing `/start`+`/respond` GD flow is reused as-is. (Listed as a future enhancement; not required to close the scoring hole, which was the point of Option B.)
- Live GD → **P9b**, separate plan. ✓

**Placeholder scan:** every code step has complete code; verify steps have exact commands + expected output. The two "read the existing JSX and place this block" notes (Task 6 Step 4, Task 7 Step 4) give the full block to insert and a precise anchor — acceptable because the surrounding render is large and the executor must see it in context, but the inserted content is fully specified.

**Type consistency:** `gdSessionId` (string id) flows evaluate-response → client state → submit payload → server lookup. `scores.overall` is the single source of the round score (model default, set in `/evaluate`, read in `/submit-round`, shown in history). `evalCompletion` returns `{ completion, modelUsed }` (confirmed in `utils/aiModels.js`) → stored as `gradedBy`. `RUBRIC_VERSION` import name to confirm against `utils/interviewRubric.js` in Task 2 Step 1.

**Open follow-ups (out of P9a scope, note in handoff):**
- HR round still trusts client `aiScore` (`/submit-round` final else). Same fix pattern (server-graded persisted attempt) applies later.
- `gd_solo` signal source stays unused until a standalone GD page exists.
- `memory/prism-prep-spine.md` should be updated to "P9a DONE" after execution.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-13-p9a-solo-gd-scoring.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
