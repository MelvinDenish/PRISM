/**
 * Pagination helper (Phase 2, plan §4).
 *
 * Many list endpoints returned unbounded result sets (or a hard-coded limit).
 * This parses `?page=&limit=` safely and returns skip/limit plus a builder for
 * the standard pagination metadata, keeping the project's `{ success, ... }` shape.
 *
 *   const { page, limit, skip } = getPagination(req.query);
 *   const [items, total] = await Promise.all([
 *     Model.find(filter).sort(...).skip(skip).limit(limit),
 *     Model.countDocuments(filter),
 *   ]);
 *   res.json({ success: true, items, pagination: buildMeta(page, limit, total) });
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function getPagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total,
  };
}

module.exports = { getPagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
