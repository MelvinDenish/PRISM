/**
 * Centralized error handling (Phase 0 foundation, see plan §4).
 *
 * Replaces the catch-all that returned 500 for everything. Distinguishes
 * operational client errors (4xx) from unexpected server faults (5xx),
 * normalizes common Mongoose/JWT errors, and keeps the project's
 * `{ success, message }` response shape.
 *
 * Usage in routes:  next(new AppError('Slot already booked', 409))
 * or simply throw inside an async handler wrapped by `asyncHandler`.
 */

const logger = require('../utils/logger');

/** Operational error with an HTTP status code. */
class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Wrap an async route handler so thrown/rejected errors reach errorHandler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 404 for unmatched routes — mount after all routes, before errorHandler. */
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/** Map framework/library errors to a status code + safe message. */
function normalize(err) {
  if (err instanceof AppError) return { statusCode: err.statusCode, message: err.message, details: err.details };

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return { statusCode: 400, message: 'Validation failed', details };
  }
  // Mongoose bad ObjectId
  if (err.name === 'CastError') return { statusCode: 400, message: `Invalid ${err.path}` };
  // Mongo duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { statusCode: 409, message: `${field} already exists` };
  }
  // JWT
  if (err.name === 'JsonWebTokenError') return { statusCode: 401, message: 'Invalid token' };
  if (err.name === 'TokenExpiredError') return { statusCode: 401, message: 'Token expired' };

  return { statusCode: 500, message: 'Internal Server Error' };
}

/** Final error handler — must be the LAST app.use() in server.js. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { statusCode, message, details } = normalize(err);
  const log = req.log || logger;

  if (statusCode >= 500) {
    log.error('unhandled_error', { message: err.message, stack: err.stack });
  } else {
    log.warn('handled_error', { statusCode, message });
  }

  const body = { success: false, message };
  if (details) body.details = details;
  // Never leak stack traces in production responses.
  if (statusCode >= 500 && process.env.NODE_ENV !== 'production') body.error = err.message;

  res.status(statusCode).json(body);
}

module.exports = { AppError, asyncHandler, notFound, errorHandler };
