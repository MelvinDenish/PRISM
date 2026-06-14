/**
 * Company eligibility checker (Phase 1).
 *
 * Compares a User's academics against a Company's CUIC-style eligibility
 * criteria. Pure + dependency-free so it can be unit-tested and reused by the
 * companies route and any profile surface.
 *
 * Three outcomes per company:
 *   - eligible: true                → meets every set criterion
 *   - eligible: false (reasons[])   → fails at least one criterion
 *   - unknown: true (missing[])     → can't tell; the student hasn't filled in
 *                                     the academic field a criterion needs
 * A company with NO criteria is open to everyone (eligible: true).
 */

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const normBranch = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function checkEligibility(user = {}, company = {}) {
  const e = (company && company.eligibility) || {};
  const reasons = [];
  const missing = [];

  const hasCriteria =
    num(e.cgpaCutoff) != null || num(e.maxActiveArrears) != null || num(e.maxHistoryArrears) != null ||
    num(e.tenthMin) != null || num(e.twelfthMin) != null ||
    (Array.isArray(e.eligibleBranches) && e.eligibleBranches.length > 0) ||
    Boolean(e.batch && String(e.batch).trim());

  if (!hasCriteria) return { eligible: true, unknown: false, hasCriteria: false, reasons, missing };

  // CGPA
  if (num(e.cgpaCutoff) != null) {
    const cg = num(user.cgpa);
    if (cg == null) missing.push('CGPA');
    else if (cg < num(e.cgpaCutoff)) reasons.push(`CGPA ${cg} is below the ${e.cgpaCutoff} cutoff`);
  }
  // Active arrears
  if (num(e.maxActiveArrears) != null) {
    const a = num(user.activeArrears);
    if (a == null) missing.push('active arrears');
    else if (a > num(e.maxActiveArrears)) reasons.push(`${a} active arrear(s) exceeds the limit of ${e.maxActiveArrears}`);
  }
  // History of arrears
  if (num(e.maxHistoryArrears) != null) {
    const a = num(user.historyArrears);
    if (a == null) missing.push('history of arrears');
    else if (a > num(e.maxHistoryArrears)) reasons.push(`${a} total arrear(s) in history exceeds the limit of ${e.maxHistoryArrears}`);
  }
  // 10th %
  if (num(e.tenthMin) != null) {
    const t = num(user.tenthPercent);
    if (t == null) missing.push('10th %');
    else if (t < num(e.tenthMin)) reasons.push(`10th ${t}% is below the ${e.tenthMin}% minimum`);
  }
  // 12th %
  if (num(e.twelfthMin) != null) {
    const t = num(user.twelfthPercent);
    if (t == null) missing.push('12th %');
    else if (t < num(e.twelfthMin)) reasons.push(`12th ${t}% is below the ${e.twelfthMin}% minimum`);
  }
  // Branch
  if (Array.isArray(e.eligibleBranches) && e.eligibleBranches.length) {
    const dept = normBranch(user.department);
    if (!dept) missing.push('department');
    else if (!e.eligibleBranches.map(normBranch).includes(dept)) reasons.push(`branch ${user.department} is not in the eligible branches`);
  }
  // Batch
  if (e.batch && String(e.batch).trim()) {
    const b = String(user.batch || user.graduationYear || '').trim();
    if (!b) missing.push('batch');
    else if (String(e.batch).trim() !== b) reasons.push(`batch ${b} does not match the required ${e.batch}`);
  }

  // Hard fails win. Otherwise, a missing field makes the result UNKNOWN (prompt
  // the student to complete their Profile) rather than a false "not eligible".
  if (reasons.length) return { eligible: false, unknown: false, hasCriteria: true, reasons, missing };
  if (missing.length) return { eligible: false, unknown: true, hasCriteria: true, reasons, missing };
  return { eligible: true, unknown: false, hasCriteria: true, reasons, missing };
}

module.exports = { checkEligibility };
