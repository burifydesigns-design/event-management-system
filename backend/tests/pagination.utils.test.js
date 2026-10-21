const {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../src/utils/pagination');

describe('parsePagination', () => {
  test('returns defaults when no params are provided', () => {
    const result = parsePagination({});
    expect(result).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  test('parses valid page and limit', () => {
    const result = parsePagination({ page: '3', limit: '25' });
    expect(result).toEqual({ page: 3, limit: 25, skip: 50 });
  });

  test('computes skip as (page - 1) * limit', () => {
    expect(parsePagination({ page: '2', limit: '10' }).skip).toBe(10);
    expect(parsePagination({ page: '5', limit: '12' }).skip).toBe(48);
  });

  test('rejects non-numeric page', () => {
    expect(parsePagination({ page: 'abc' }).error).toMatch(/page/);
  });

  test('rejects negative page', () => {
    expect(parsePagination({ page: '-1' }).error).toMatch(/page/);
  });

  test('rejects zero page', () => {
    expect(parsePagination({ page: '0' }).error).toMatch(/page/);
  });

  test('rejects fractional page', () => {
    expect(parsePagination({ page: '1.5' }).error).toMatch(/page/);
  });

  test('rejects non-numeric limit', () => {
    expect(parsePagination({ limit: 'x' }).error).toMatch(/limit/);
  });

  test('rejects negative limit', () => {
    expect(parsePagination({ limit: '-5' }).error).toMatch(/limit/);
  });

  test('clamps limit above the maximum instead of rejecting', () => {
    const result = parsePagination({ limit: String(MAX_LIMIT + 500) });
    expect(result.error).toBeUndefined();
    expect(result.limit).toBe(MAX_LIMIT);
  });

  test('honours a custom default limit', () => {
    expect(parsePagination({}, { defaultLimit: 10 }).limit).toBe(10);
  });

  test('honours a custom max limit', () => {
    const result = parsePagination({ limit: '50' }, { maxLimit: 20 });
    expect(result.limit).toBe(20);
  });
});

describe('buildPaginationMeta', () => {
  test('builds metadata for a normal page', () => {
    expect(buildPaginationMeta({ page: 2, limit: 10, totalItems: 25 })).toEqual({
      page: 2,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  test('first page has no previous page', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 10, totalItems: 10 });
    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.hasNextPage).toBe(false);
  });

  test('empty collection yields zero pages and no navigation flags', () => {
    expect(buildPaginationMeta({ page: 1, limit: 10, totalItems: 0 })).toEqual({
      page: 1,
      limit: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  test('page beyond the last page reports no next page', () => {
    const meta = buildPaginationMeta({ page: 99, limit: 10, totalItems: 25 });
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });
});
