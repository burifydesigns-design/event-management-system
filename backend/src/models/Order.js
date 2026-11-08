const { getSupabase } = require('../config/db');

module.exports = {
  async create(data) {
    const payload = {
      attendee_id: data.attendee || data.attendee_id,
      event_id: data.event || data.event_id,
      total_amount: data.totalAmount ?? data.total_amount ?? 0,
      status: data.status || 'pending',
    };
    const { data: row, error } = await getSupabase().from('orders').insert(payload).select('*').single();
    if (error) throw error;
    return row;
  },
  async findById(id) {
    const { data, error } = await getSupabase().from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
};
