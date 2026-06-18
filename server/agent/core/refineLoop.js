/**
 * refineLoop — the shared agentic "verify-then-ship" loop for PRISM.
 *
 * Generalizes the verify-then-ship pattern already living in pockets of the repo
 * (resume Stage-C self-heal, validateCodingProblems' execute-verify, pathTest's
 * answer-in-options) into ONE bounded loop:
 *
 *   1. Best-of-N: run `proposers` in PARALLEL → N candidate drafts.
 *   2. Verify each against GROUND TRUTH (`verify` → { pass, score, feedback }).
 *   3. keepBest: remember the highest-scoring candidate ever seen.
 *   4. Reflexion: if the best isn't passing, `repair(best, feedback)` → re-verify,
 *      up to `maxN` rounds, early-exiting the moment a candidate passes.
 *   5. ALWAYS return the best-scoring candidate — so extra rounds can only help or
 *      be neutral, never ship something worse (neutralizes the documented
 *      over-refinement degradation of weak models).
 *
 * This is pure orchestration — no LLM/provider knowledge. Callers supply the
 * model-bound `proposers`, the `verify` (which may itself call a vision/metric
 * critic), and the `repair`. Keep this file dependency-free and easy to hold in
 * one read.
 */

const NEG_INF = Number.NEGATIVE_INFINITY;

// Normalize a verify() result into a comparable shape. A thrown/garbage verify is
// treated as the worst possible score so it can never win keepBest.
function normResult(r) {
  if (!r || typeof r !== 'object') return { pass: false, score: NEG_INF, feedback: '' };
  return {
    pass: Boolean(r.pass),
    score: typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : (r.pass ? 0 : NEG_INF),
    feedback: r.feedback == null ? '' : r.feedback,
    meta: r.meta,
  };
}

async function verifySafe(verify, candidate) {
  try { return normResult(await verify(candidate)); }
  catch (err) { return { pass: false, score: NEG_INF, feedback: `verify error: ${err.message}` }; }
}

/**
 * @param {object}   opts
 * @param {Array<() => Promise<any>>} opts.proposers  initial best-of-N drafters (≥1), run in parallel
 * @param {(candidate:any) => Promise<{pass:boolean,score:number,feedback:any}>} opts.verify  ground-truth verifier
 * @param {(candidate:any, feedback:any) => Promise<any>} [opts.repair]  reflexion fixer (required when maxN>0)
 * @param {number}   [opts.maxN=2]   max repair rounds after the initial draft(s); resume design uses 5
 * @param {number}   [opts.deadlineMs]  optional wall-clock budget — stop STARTING new repair rounds
 *                   once exceeded (ships best-so-far). Bounds latency on a synchronous request so a
 *                   slow provider can't make maxN rounds run away.
 * @param {(ev:{phase:string,round:number,score:number,pass:boolean}) => void} [opts.onRound]  observability hook
 * @returns {Promise<{candidate:any, result:object, rounds:number, history:object[]}>}
 *          `candidate`/`result` are the BEST (highest-score) ever seen.
 */
async function refineLoop({ proposers, verify, repair, maxN = 2, deadlineMs, onRound } = {}) {
  const startedAt = Date.now();
  if (!Array.isArray(proposers) || proposers.length === 0) {
    throw new Error('refineLoop: at least one proposer is required');
  }
  if (typeof verify !== 'function') throw new Error('refineLoop: verify is required');

  const history = [];
  let best = null; // { candidate, result }

  const consider = (candidate, result, phase, round) => {
    history.push({ phase, round, score: result.score, pass: result.pass });
    if (onRound) { try { onRound({ phase, round, score: result.score, pass: result.pass }); } catch { /* hook must never break the loop */ } }
    if (!best || result.score > best.result.score) best = { candidate, result };
  };

  // ── Round 0: best-of-N parallel drafts, each verified ───────────────────────
  const drafts = await Promise.allSettled(proposers.map((p) => p()));
  await Promise.all(drafts.map(async (d, i) => {
    if (d.status !== 'fulfilled' || d.value == null) {
      history.push({ phase: 'draft', round: 0, score: NEG_INF, pass: false, error: d.reason?.message });
      return;
    }
    const result = await verifySafe(verify, d.value);
    consider(d.value, result, 'draft', 0);
  }));

  if (!best) {
    // Surface the first proposer rejection (status/message) so callers can detect a
    // provider rate-limit (429) etc. through the otherwise-generic loop failure.
    const firstErr = drafts.find((d) => d.status === 'rejected')?.reason;
    const e = new Error('refineLoop: every proposer failed to produce a candidate');
    if (firstErr) { e.cause = firstErr; e.status = firstErr.status; }
    throw e;
  }
  if (best.result.pass) return { candidate: best.candidate, result: best.result, rounds: 0, history };

  // ── Reflexion: iterate FORWARD from the LATEST candidate, re-verifying each round
  //    so the repair gets FRESH feedback. `best` (highest score) is tracked
  //    separately and is what we return. Repairing `best` with its own stale feedback
  //    every round (the naive version) would re-feed identical input whenever a round
  //    fails to improve → identical output → the loop stalls and silently wastes the
  //    rest of the budget. Advancing `current` unconditionally avoids that, while
  //    `best`+keepBest still guarantees we never SHIP a regression. Early-exit on pass.
  let current = best;
  let rounds = 0;
  for (let round = 1; round <= maxN && typeof repair === 'function'; round++) {
    if (deadlineMs && Date.now() - startedAt > deadlineMs) break; // wall-clock budget → ship best
    let repaired;
    try { repaired = await repair(current.candidate, current.result.feedback); }
    catch (err) { history.push({ phase: 'repair', round, score: NEG_INF, pass: false, error: err.message }); break; }
    if (repaired == null) break;

    rounds = round;
    const result = await verifySafe(verify, repaired);
    consider(repaired, result, 'repair', round); // updates `best` iff strictly higher
    current = { candidate: repaired, result };    // ALWAYS advance, even if this round regressed
    if (result.pass) break;                        // good enough → stop early
  }

  return { candidate: best.candidate, result: best.result, rounds, history };
}

module.exports = { refineLoop };
