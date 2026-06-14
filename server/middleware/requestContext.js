/**
 * Per-request context: assigns a request id, exposes a child logger on
 * `req.log`, and logs request completion with status + duration.
 * (Phase 0 foundation, see plan §4.)
 *
 * Mount early in server.js, before routes.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

function requestContext(req, res, next) {
  // Honor an upstream id (from nginx/load balancer) or generate one.
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id });

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user && req.user._id ? String(req.user._id) : undefined,
    };
    if (res.statusCode >= 500) req.log.error('request_failed', meta);
    else if (res.statusCode >= 400) req.log.warn('request_client_error', meta);
    else req.log.info('request_completed', meta);
  });

  next();
}

module.exports = requestContext;
