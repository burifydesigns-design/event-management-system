const { getSupabase } = require('../config/db');

function shape(row) {
  if (!row) return row;
  return { ...row, date: row.event_date ?? row.date, time: row.event_time ?? row.time };
}

function toDb(data = {}) {
  const out = { ...data };
  if (out.date !== undefined && out.event_date === undefined) out.event_date = out.date;
  if (out.time !== undefined && out.event_time === undefined) out.event_time = out.time;
  delete out.date;
  delete out.time;
  if (out.organizer !== undefined && out.organizer_id === undefined) out.organizer_id = out.organizer;
  delete out.organizer;
  return out;
}

module.exports = {
  _shape: shape,
  async find(filter = {}) {
    let q = getSupabase().from('events').select('*').order('event_date', { ascending: true });
    if (filter && filter.status) q = q.eq('status', filter.status);
    if (filter && filter.organizer) q = q.eq('organizer_id', filter.organizer);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(shape);
  },
  async findById(id) {
    const { data, error } = await getSupabase().from('events').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return shape(data);
  },
  async create(data) {
    const { data: row, error } = await getSupabase().from('events').insert(toDb(data)).select('*').single();
    if (error) throw error;
    return shape(row);
  },
  async countDocuments(filter = {}) {
    let q = getSupabase().from('events').select('id', { count: 'exact', head: true });
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },
};
