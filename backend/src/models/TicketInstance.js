const { getSupabase } = require('../config/db');

function shape(row) {
  if (!row) return row;
  return {
    ...row,
    order: row.order_id ?? row.order,
    ticketType: row.ticket_type_id ?? row.ticketType,
    event: row.event_id ?? row.event,
    attendee: row.attendee_id ?? row.attendee,
    qrToken: row.qr_token ?? row.qrToken,
    scannedAt: row.scanned_at ?? row.scannedAt,
    scannedBy: row.scanned_by ?? row.scannedBy,
  };
}

module.exports = {
  async find(filter = {}) {
    let q = getSupabase().from('ticket_instances').select('*').order('created_at', { ascending: false });
    if (filter && filter.attendee) q = q.eq('attendee_id', filter.attendee);
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(shape);
  },
  async findOne(filter = {}) {
    let q = getSupabase().from('ticket_instances').select('*');
    if (filter && filter.qrToken) q = q.eq('qr_token', filter.qrToken);
    if (filter && filter.id) q = q.eq('id', filter.id);
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return shape(data);
  },
  async create(data) {
    const payload = {
      order_id: data.order || data.order_id,
      ticket_type_id: data.ticketType || data.ticket_type_id,
      event_id: data.event || data.event_id,
      attendee_id: data.attendee || data.attendee_id,
      qr_token: data.qrToken || data.qr_token,
      status: data.status || 'valid',
    };
    const { data: row, error } = await getSupabase().from('ticket_instances').insert(payload).select('*').single();
    if (error) throw error;
    return shape(row);
  },
  async countDocuments(filter = {}) {
    let q = getSupabase().from('ticket_instances').select('id', { count: 'exact', head: true });
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    if (filter && filter.status) q = q.eq('status', filter.status);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  },
};
