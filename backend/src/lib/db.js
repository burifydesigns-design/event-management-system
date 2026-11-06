const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function camelToSnake(str) {
  return String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function snakeToCamel(str) {
  return String(str).replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function toSnake(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toSnake);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      let key = k === '_id' ? 'id' : camelToSnake(k);
      out[key] = toSnake(v);
    }
    return out;
  }
  return value;
}

function toCamel(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toCamel);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      let key = snakeToCamel(k);
      out[key] = toCamel(v);
    }
    if (out.id !== undefined && out._id === undefined) {
      out._id = out.id;
    }
    return out;
  }
  return value;
}

function escapeLike(pattern) {
  return String(pattern).replace(/([%_\\])/g, '\\$1');
}

function columnName(key) {
  return key === '_id' ? 'id' : camelToSnake(key);
}

function applyFilters(q, filter) {
  for (const [key, value] of Object.entries(filter || {})) {
    if (key === '$or') {
      const parts = Array.isArray(value)
        ? value.map((cond) =>
            Object.entries(cond || {})
              .map(([f, v]) => {
                const col = columnName(f);
                if (v && typeof v === 'object' && v.$regex) {
                  return `${col}.ilike.%${escapeLike(v.$regex)}%`;
                }
                return `${col}.eq.${v}`;
              })
              .join(',')
          )
        : [];
      q = q.or(parts.join(','));
      continue;
    }
    const col = columnName(key);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (value.$in !== undefined) q = q.in(col, value.$in.map(toSnake));
      else if (value.$ne !== undefined) q = q.neq(col, toSnake(value.$ne));
      else if (value.$gt !== undefined) q = q.gt(col, toSnake(value.$gt));
      else if (value.$gte !== undefined) q = q.gte(col, toSnake(value.$gte));
      else if (value.$lt !== undefined) q = q.lt(col, toSnake(value.$lt));
      else if (value.$lte !== undefined) q = q.lte(col, toSnake(value.$lte));
      else if (value.$regex !== undefined) {
        q = q.ilike(col, `%${escapeLike(value.$regex)}%`);
      } else {
        q = q.eq(col, toSnake(value));
      }
    } else {
      q = q.eq(col, toSnake(value));
    }
  }
  return q;
}

function normalizeSelect(select) {
  if (!select || select === '*') return '*';
  return String(select)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((c) => (c === '_id' ? 'id' : c))
    .join(',');
}

async function selectAll(table, opts = {}) {
  const {
    filter,
    select = '*',
    order: orderOpt,
    sort,
    limit,
    offset,
    skip,
    count: countMode = false,
  } = opts;
  const order = orderOpt ?? sort;
  const effectiveOffset = offset ?? skip;
  const selectCols = normalizeSelect(select);
  let q = supabase.from(table).select(selectCols, countMode ? { head: true, count: 'exact' } : {});
  q = applyFilters(q, filter);
  if (order) {
    const orders = Array.isArray(order) ? order : Object.entries(order);
    for (const [field, dir] of orders) {
      q = q.order(columnName(field), { ascending: dir !== -1 });
    }
  }
  if (limit !== undefined) {
    const start = effectiveOffset !== undefined ? effectiveOffset : 0;
    q = q.range(start, start + Number(limit) - 1);
  }
  const { data, error, count: c } = await q;
  if (error) throw error;
  if (countMode) return { rows: [], count: c };
  return { rows: (data || []).map(toCamel), count: undefined };
}

async function find(table, opts = {}) {
  const { rows, count } = await selectAll(table, opts);
  if (opts.populate) await populateRows(rows, normalizePopulate(opts.populate));
  return { rows, count };
}

async function findOne(table, opts = {}) {
  const { rows } = await selectAll(table, { ...opts, limit: 1 });
  const row = rows[0];
  if (!row) return null;
  if (opts.populate) await populateRows([row], normalizePopulate(opts.populate));
  return row;
}

async function findById(table, id, opts = {}) {
  return findOne(table, { ...opts, filter: { ...opts.filter, id } });
}

const DEFAULTS = {
  users: { role: 'attendee', is_super_admin: false, status: 'active' },
  events: { status: 'draft' },
  ticket_types: { quantity_sold: 0 },
  orders: { status: 'pending' },
  registrations: { status: 'confirmed', checked_in: false, email_sent: false },
  ticket_instances: { status: 'issued' },
  check_in_logs: {},
  ticket_email_logs: { status: 'pending', attempts: 0 },
  coordinator_assignments: {},
};

async function create(table, data) {
  const isArray = Array.isArray(data);
  const docs = isArray ? data : [data];
  const now = new Date().toISOString();
  const inserted = docs.map((doc) => {
    const defaults = DEFAULTS[table] || {};
    const payload = { ...defaults, ...toSnake(doc) };
    if (payload.created_at === undefined) payload.created_at = now;
    if (payload.updated_at === undefined) payload.updated_at = now;
    if (payload.registered_at === undefined) payload.registered_at = now;
    if (payload.scanned_at === undefined) payload.scanned_at = now;
    return payload;
  });
  const { data: result, error } = await supabase.from(table).insert(inserted);
  if (error) throw error;
  const created = (result || []).map(toCamel);
  return isArray ? created : created[0];
}

async function updateById(table, id, data) {
  const payload = data && data.$set ? data.$set : data;
  const updatePayload = toSnake(payload);
  updatePayload.updated_at = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', id);
  if (error) throw error;
  return (updated || [])[0] ? toCamel((updated || [])[0]) : null;
}

async function updateOne(table, filter, data) {
  const payload = data && data.$set ? data.$set : data;
  const updatePayload = toSnake(payload);
  updatePayload.updated_at = new Date().toISOString();
  let q = supabase.from(table).update(updatePayload);
  q = applyFilters(q, filter);
  const { data: updated, error } = await q;
  if (error) throw error;
  return (updated || [])[0] ? toCamel((updated || [])[0]) : null;
}

async function updateMany(table, filter, data) {
  const payload = data && data.$set ? data.$set : data;
  const updatePayload = toSnake(payload);
  updatePayload.updated_at = new Date().toISOString();
  let q = supabase.from(table).update(updatePayload);
  q = applyFilters(q, filter);
  const { data: updated, error } = await q;
  if (error) throw error;
  return (updated || []).length;
}

async function upsertOne(table, filter, data) {
  const existing = await findOne(table, { filter });
  if (existing) return existing;
  return create(table, { ...toSnake(filter), ...toSnake(data) });
}

async function removeById(table, id) {
  const { data: deleted, error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return (deleted || [])[0] ? toCamel((deleted || [])[0]) : null;
}

async function remove(table, filter) {
  let q = supabase.from(table).delete();
  q = applyFilters(q, filter);
  const { data: deleted, error } = await q;
  if (error) throw error;
  return (deleted || []).length;
}

async function count(table, filter) {
  const { count: c } = await selectAll(table, { filter, count: true });
  return c || 0;
}

async function distinct(table, field, filter) {
  const col = columnName(field);
  let q = supabase.from(table).select(col);
  q = applyFilters(q, filter);
  const { data } = await q;
  const values = (data || [])
    .map((row) => row[col])
    .filter((v) => v != null);
  return [...new Set(values)];
}

const RELATED_TABLES = {
  organizer: 'users',
  event: 'events',
  user: 'users',
  ticketType: 'ticket_types',
  ticket_type: 'ticket_types',
  scannedBy: 'users',
};

function normalizePopulate(populate) {
  if (!populate) return [];
  if (typeof populate === 'string') {
    return populate.split(/\s+/).filter(Boolean).map((path) => ({ path }));
  }
  if (Array.isArray(populate)) {
    return populate.map((spec) => {
      if (typeof spec === 'string') return { path: spec };
      return spec;
    });
  }
  return [populate];
}

async function populateRows(rows, specs) {
  if (!rows || !rows.length || !specs.length) return rows;
  for (const spec of specs) {
    const path = spec.path;
    const table = spec.table || RELATED_TABLES[path] || path;
    const fk = path;
    const ids = [...new Set(rows.map((r) => r[fk]).filter(Boolean))];
    if (!ids.length) {
      for (const row of rows) row[path] = null;
      continue;
    }
    const selectCols = spec.fields
      ? 'id,' +
        String(spec.fields)
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => (c === '_id' ? 'id' : c))
          .join(',')
      : '*';
    const { data: related, error } = await supabase
      .from(table)
      .select(selectCols)
      .in('id', ids);
    if (error) throw error;
    const relatedMap = {};
    for (const r of related || []) {
      relatedMap[r.id] = toCamel(r);
    }
    for (const row of rows) {
      const refId = row[fk];
      row[path] = refId && relatedMap[refId] ? relatedMap[refId] : null;
    }
  }
  return rows;
}

module.exports = {
  supabase,
  isValidUuid,
  find,
  findOne,
  findById,
  create,
  updateById,
  updateOne,
  updateMany,
  upsertOne,
  removeById,
  remove,
  count,
  distinct,
  toCamel,
  toSnake,
};
