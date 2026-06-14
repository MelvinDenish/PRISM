/**
 * Lightweight request validation (Phase 0 foundation, see plan §4).
 *
 * Replaces ad-hoc per-route hand validation with reusable field schemas.
 * Dependency-free for now; the same `validate(schema, source)` call sites can
 * later be backed by zod without changing route code if the team standardizes.
 *
 * Schema shape (per field):
 *   { required, type, min, max, minLength, maxLength, enum, email, trim, default }
 *
 * On failure throws AppError(400) with a `details` array; on success replaces
 * the validated source object with the coerced/sanitized values.
 */

const { AppError } = require('./errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkField(name, value, rule, errors) {
  // Absence
  if (value === undefined || value === null || value === '') {
    if (rule.required) errors.push(`${name} is required`);
    return rule.default !== undefined ? rule.default : value;
  }

  // Type coercion / checks
  if (rule.type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) { errors.push(`${name} must be a number`); return value; }
    value = n;
    if (rule.min !== undefined && value < rule.min) errors.push(`${name} must be >= ${rule.min}`);
    if (rule.max !== undefined && value > rule.max) errors.push(`${name} must be <= ${rule.max}`);
  } else if (rule.type === 'array') {
    if (!Array.isArray(value)) errors.push(`${name} must be an array`);
  } else {
    // default: string
    if (typeof value !== 'string') { errors.push(`${name} must be a string`); return value; }
    if (rule.trim) value = value.trim();
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${name} must be at least ${rule.minLength} characters`);
    if (rule.maxLength !== undefined && value.length > rule.maxLength) errors.push(`${name} must be at most ${rule.maxLength} characters`);
    if (rule.email && !EMAIL_RE.test(value)) errors.push(`${name} must be a valid email`);
    if (rule.pattern && !rule.pattern.test(value)) errors.push(rule.patternMessage || `${name} is not in the required format`);
  }

  if (rule.enum && !rule.enum.includes(value)) errors.push(`${name} must be one of: ${rule.enum.join(', ')}`);

  return value;
}

/**
 * @param {Object} schema  field -> rule
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = [];
    const cleaned = {};

    for (const [name, rule] of Object.entries(schema)) {
      cleaned[name] = checkField(name, data[name], rule, errors);
    }

    if (errors.length) return next(new AppError('Validation failed', 400, errors));

    // Keep any extra fields the schema didn't mention, but prefer cleaned values.
    req[source] = { ...data, ...cleaned };
    next();
  };
}

module.exports = { validate };
