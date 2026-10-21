const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

/**
 * Parse and validate pagination query parameters (page / limit).
 *
 * Follows the project's validation convention: invalid input produces an
 * `error` message that controllers surface as a 400 JSON response.
 * Values above `maxLimit` are clamped rather than rejected.
 *
 * @param {object} query - req.query
 * @param {object} [options]
 * @param {number} [options.defaultLimit=12] - limit used when not provided
 * @param {number} [options.maxLimit=100] - upper bound enforced on limit
 * @returns {{ page: number, limit: number, skip: number, error?: string }}
 */
function parsePagination(query = {}, options = {}) {
  const { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = options;

  const rawPage = query.page;
  const rawLimit = query.limit;

  if (rawPage !== undefined) {
    const page = Number(rawPage);
    if (!Number.isInteger(page) || page < 1) {
      return { error: 'page must be a positive integer' };
    }
  }

  if (rawLimit !== undefined) {
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1) {
      return { error: 'limit must be a positive integer' };
    }
  }

  const page = rawPage === undefined ? DEFAULT_PAGE : Number(rawPage);
  let limit = rawLimit === undefined ? defaultLimit : Number(rawLimit);
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build the standard pagination metadata returned alongside paginated data.
 * `totalPages` is 0 for empty collections; pages beyond the last page return
 * an empty `data` array with `hasNextPage: false`.
 */
function buildPaginationMeta({ page, limit, totalItems }) {
  const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 0;
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

module.exports = {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};