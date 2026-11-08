const { getSupabase } = require('../config/db');

function shape(row) {
  if (!row) return row;
  return {
    ...row,
    quantityAvailable: row.quantity_available ?? row.quantityAvailable,
    quantitySold: row.quantity_sold ?? row.quantitySold,
    event: row.event_id ?? row.event,
  };
}

module.exports = {
  async find(filter = {}) {
    let q = getSupabase().from('ticket_types').select('*');
    if (filter && filter.event) q = q.eq('event_id', filter.event);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(shape);
  },
  async findById(id) {
    const { data, error } = await getSupabase().from('ticket_types').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return shape(data);
  },
  async create(data) {
    const payload = {
      event_id: data.event || data.event_id,
      name: data.name,
      price: data.price,
      quantity_available: data.quantityAvailable ?? data.quantity_available,
      quantity_sold: data.quantitySold ?? data.quantity_sold ?? 0,
    };
    const { data: row, error } = await getSupabase().from('ticket_types').insert(payload).select('*').single();
    if (error) throw error;
    return shape(row);
  },
};
