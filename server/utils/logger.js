/**
 * Minimal structured logger (Phase 0 foundation, see plan §4).
 *
 * Emits one JSON line per event so logs are greppable / ingestable, but stays
 * dependency-free. Can be swapped for pino later behind this same interface
 * (log.info / log.warn / log.error / log.debug) without touching call sites.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function emit(level, msg, meta) {
  if (LEVELS[level] < threshold) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta && typeof meta === 'object' ? meta : meta !== undefined ? { meta } : {}),
  };
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(JSON.stringify(line) + '\n');
}

const logger = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
  /** Child logger that injects fixed fields (e.g. requestId) into every line. */
  child: (fixed) => ({
    debug: (msg, meta) => emit('debug', msg, { ...fixed, ...meta }),
    info: (msg, meta) => emit('info', msg, { ...fixed, ...meta }),
    warn: (msg, meta) => emit('warn', msg, { ...fixed, ...meta }),
    error: (msg, meta) => emit('error', msg, { ...fixed, ...meta }),
  }),
};

module.exports = logger;
