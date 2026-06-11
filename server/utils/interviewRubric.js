/**
 * Anchored scoring rubric for AI interview / GD evaluation (plan Phase 1, B4).
 *
 * Free-form "score 0-100" prompts drift run-to-run, so the same answer can score
 * 60 once and 80 the next time — making any trend meaningless. This rubric gives
 * the model fixed anchors. The version string is stored with every persisted
 * attempt so that when the rubric changes, old scores aren't compared to new ones.
 */

// Bump when the anchors below change in a way that shifts scores.
const RUBRIC_VERSION = 'v1-2026-06';

const SCALE = `Score every dimension 0-100 using these fixed anchors:
- 0-20: no usable evidence, or did not address the question.
- 21-40: vague, generic, or partially incorrect; little depth.
- 41-60: adequate but shallow — correct basics, missing depth/structure.
- 61-80: solid, specific, and well-structured with only minor gaps.
- 81-100: excellent — precise, deep, well-reasoned, with concrete examples.
Anchor strictly to the candidate's ACTUAL words. Never assume or invent answers
they did not give; unanswered or off-topic content scores in the 0-20 band.`;

const rubricBlock = () => SCALE;

module.exports = { RUBRIC_VERSION, rubricBlock };
