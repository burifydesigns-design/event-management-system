const jwt = require('jsonwebtoken');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// Mock @supabase/supabase-js with an in-memory fake so the test suite can run
// without a real Supabase instance or credentials.
jest.mock('@supabase/supabase-js', () => {
  const mockCrypto = require('crypto');
  const store = {};

  const UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  function isValidUuid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function likeMatches(value, pattern) {
    let p = String(pattern);
    const leading = p.startsWith('%');
    const trailing = p.endsWith('%');
    if (leading) p = p.slice(1);
    if (trailing) p = p.slice(0, -1);
    let regex = '';
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ch === '%') regex += '.*';
      else if (ch === '_') regex += '.';
      else regex += escapeRegExp(ch);
    }
    const re = new RegExp(`^${leading ? '.*' : ''}${regex}${trailing ? '.*' : ''}$`, 'i');
    return re.test(String(value == null ? '' : value));
  }

  function matchOp(row, f) {
    const rv = row[f.col];
    switch (f.op) {
      case 'eq': return rv == f.value;
      case 'neq': return rv != f.value;
      case 'gt': return rv > f.value;
      case 'gte': return rv >= f.value;
      case 'lt': return rv < f.value;
      case 'lte': return rv <= f.value;
      case 'in': return Array.isArray(f.value) && f.value.includes(rv);
      case 'ilike': return likeMatches(rv, f.value);
      default: return true;
    }
  }

  function applyRow(row, filters) {
    const andFilters = filters.filter((f) => !f._or);
    const orFilters = filters.filter((f) => f._or);
    const andOk = andFilters.every((f) => matchOp(row, f));
    const orOk = orFilters.length === 0 || orFilters.some((f) => matchOp(row, f));
    return andOk && orOk;
  }

  function makeQueryBuilder(table) {
    const state = {
      table,
      filters: [],
      orders: [],
      range: null,
      selectCols: '*',
      count: false,
      head: false,
      single: false,
      op: null,
      opArgs: null,
    };

    const builder = {
      eq(col, value) { state.filters.push({ col, op: 'eq', value }); return builder; },
      neq(col, value) { state.filters.push({ col, op: 'neq', value }); return builder; },
      gt(col, value) { state.filters.push({ col, op: 'gt', value }); return builder; },
      gte(col, value) { state.filters.push({ col, op: 'gte', value }); return builder; },
      lt(col, value) { state.filters.push({ col, op: 'lt', value }); return builder; },
      lte(col, value) { state.filters.push({ col, op: 'lte', value }); return builder; },
      in(col, value) { state.filters.push({ col, op: 'in', value }); return builder; },
      ilike(col, pattern) { state.filters.push({ col, op: 'ilike', value: pattern }); return builder; },
      or(condString) {
        for (const part of String(condString).split(',')) {
          const m = part.match(/^(.+?)\.(eq|neq|gt|gte|lt|lte|in|ilike)\.(.*)$/);
          if (m) {
            const [, col, op, val] = m;
            state.filters.push({ col, op, value: op === 'in' ? val.split(',') : val, _or: true });
          }
        }
        return builder;
      },
      order(col, opts) { state.orders.push([col, opts && opts.ascending !== false]); return builder; },
      range(start, end) { state.range = [start, end]; return builder; },
      select(cols, opts) {
        state.selectCols = cols;
        if (opts) { state.head = !!opts.head; state.count = !!opts.count; }
        return builder;
      },
      single() { state.single = true; return builder; },
      insert(rows) { state.op = 'insert'; state.opArgs = [rows]; return builder; },
      update(changes) { state.op = 'update'; state.opArgs = [changes]; return builder; },
      delete() { state.op = 'delete'; state.opArgs = []; return builder; },
      upsert(rows, opts) { state.op = 'upsert'; state.opArgs = [rows, opts]; return builder; },
    };

    function execute() {
      const tableRows = store[state.table] || [];

      if (state.op === 'insert') {
        const rowsToInsert = state.opArgs[0];
        const now = new Date().toISOString();
        const inserted = rowsToInsert.map((r) => ({
          id: r.id || mockCrypto.randomUUID(),
          created_at: r.created_at || now,
          updated_at: r.updated_at || now,
          ...r,
        }));
        store[state.table] = [...tableRows, ...inserted];
        return { data: inserted, error: null, count: undefined };
      }

      if (state.op === 'update') {
        const changes = state.opArgs[0];
        const now = new Date().toISOString();
        const updatePayload = { ...changes, updated_at: now };
        const updated = [];
        for (const row of tableRows) {
          if (applyRow(row, state.filters)) {
            Object.assign(row, updatePayload);
            updated.push(row);
          }
        }
        return { data: updated, error: null, count: undefined };
      }

      if (state.op === 'delete') {
        const deleted = tableRows.filter((r) => applyRow(r, state.filters));
        const remaining = tableRows.filter((r) => !deleted.includes(r));
        store[state.table] = remaining;
        return { data: deleted, error: null, count: undefined };
      }

      if (state.op === 'upsert') {
        const rowsToUpsert = state.opArgs[0];
        const opts = state.opArgs[1] || {};
        const now = new Date().toISOString();
        const result = [];
        const remaining = [...tableRows];
        for (const r of rowsToUpsert) {
          const matchIdx = remaining.findIndex((row) => applyRow(row, state.filters));
          if (matchIdx >= 0 && !opts.ignoreDuplicates) {
            Object.assign(remaining[matchIdx], { ...r, updated_at: now });
            result.push(remaining[matchIdx]);
          } else if (matchIdx >= 0 && opts.ignoreDuplicates) {
            result.push(remaining[matchIdx]);
          } else {
            const inserted = { id: r.id || mockCrypto.randomUUID(), created_at: now, updated_at: now, ...r };
            remaining.push(inserted);
            result.push(inserted);
          }
        }
        store[state.table] = remaining;
        return { data: result, error: null, count: undefined };
      }

      // Read (select) path.
      let filtered = tableRows.filter((r) => applyRow(r, state.filters));
      filtered.sort((a, b) => {
        for (const [col, asc] of state.orders) {
          const av = a[col];
          const bv = b[col];
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
        }
        return 0;
      });

      if (state.count) {
        return { data: null, error: null, count: filtered.length };
      }

      let data = state.range ? filtered.slice(state.range[0], state.range[1] + 1) : filtered;
      if (state.single) {
        return { data: data.length ? data[0] : null, error: null, count: undefined };
      }
      return { data, error: null, count: undefined };
    }

    builder.then = function (resolve, reject) {
      try {
        const result = execute();
        resolve(result);
      } catch (e) {
        reject(e);
      }
      return Promise.resolve();
    };

    builder.catch = function () { return builder; };
    return builder;
  }

  const fakeClient = {
    from(table) {
      if (!store[table]) store[table] = [];
      return makeQueryBuilder(table);
    },
  };

  return {
    __esModule: true,
    default: fakeClient,
    createClient: jest.fn(() => fakeClient),
    __store: store,
    __clearStore: () => {
      for (const key of Object.keys(store)) store[key] = [];
    },
    isValidUuid,
  };
});

/**
 * Start the Express app pointed at the in-memory fake Supabase store.
 */
async function setupTestApp() {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.NODE_ENV = 'test';

  const app = require('../src/app');
  return { app };
}

async function teardownTestApp() {
  // Nothing to tear down; the in-memory store is cleared between tests.
}

function clearDatabase() {
  const mod = require('@supabase/supabase-js');
  if (mod.__clearStore) mod.__clearStore();
}

/** Create a signed JWT matching authController.signToken's payload shape. */
function authToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = {
  setupTestApp,
  teardownTestApp,
  clearDatabase,
  authToken,
};
