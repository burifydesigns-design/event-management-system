const { getSupabase } = require('../config/db');

function shape(row) {
  if (!row) return row;
  const event = row.event
    ? { ...row.event, date: row.event.event_date ?? row.event.date, time: row.event.event_time ?? row.event.time }
    : row.event;
  return {
    ...row,
    user: row.user_id ?? row.user,
    eventId: row.event_id ?? row.eventId,
    ticketNumber: row.ticket_number ?? row.ticketNumber,
    checkedIn: row.checked_in ?? row.checkedIn,
    checkedInAt: row.checked_in_at ?? row.checkedInAt,
    registeredAt: row.registered_at ?? row.registeredAt,
    event,
  };
}

module.exports = {
  async find(filter = {}) {
    let q = getSupabase().from('registrations').select('*, event:events(*)').order('registered_at', { ascending: false });
    if (filter && filter.user) q = q.eq('user_id', filter.user);
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(shape);
  },
  async findOne(filter = {}) {
    let q = getSupabase().from('registrations').select('*, event:events(*)');
    if (filter && filter.user) q = q.eq('user_id', filter.user);
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    if (filter && filter.id) q = q.eq('id', filter.id);
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return shape(data);
  },
  async findById(id) {
    const { data, error } = await getSupabase().from('registrations').select('*, event:events(*)').eq('id', id).maybeSingle();
    if (error) throw error;
    return shape(data);
  },
  async create(data) {
    const payload = {
      user_id: data.user || data.user_id,
      event_id: data.event || data.event_id,
      ticket_number: data.ticketNumber || data.ticket_number,
      status: data.status || 'confirmed',
    };
    const { data: row, error } = await getSupabase().from('registrations').insert(payload).select('*, event:events(*)').single();
    if (error) throw error;
    return shape(row);
  },
  async countDocuments(filter = {}) {
    let q = getSupabase().from('registrations').select('id', { count: 'exact', head: true });
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },
};
