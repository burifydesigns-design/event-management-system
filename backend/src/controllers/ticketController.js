const { getSupabase } = require('../config/db');
const db = () => getSupabase();

exports.createTicketType = async (req, res, next) => {
  try {
    const { event_id: eventId, event: legacyEvent, name, price, quantity_available: quantityAvailable, quantityAvailable: legacyQuantity } = req.body || {};
    const event = eventId || legacyEvent;
    const quantity = quantityAvailable ?? legacyQuantity;
    if (!event || !String(name || '').trim() || !Number.isFinite(Number(price)) || Number(price) < 0 ||
        !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
      return res.status(400).json({ message: 'event, name, non-negative price and non-negative integer quantity_available are required' });
    }
    const { data: eventRow, error: eventError } = await db().from('events')
      .select('id,organizer_id').eq('id', event).maybeSingle();
    if (eventError) throw eventError;
    if (!eventRow) return res.status(404).json({ message: 'Event not found' });
    if (eventRow.organizer_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot manage ticket types for this event' });
    }
    const { data, error } = await db().from('ticket_types').insert({
      event_id: event, name: String(name).trim(), price: Number(price),
      quantity_available: Number(quantity), quantity_sold: 0,
    }).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

exports.listTicketTypesForEvent = async (req, res, next) => {
  try {
    const { data: event, error: eventError } = await db().from('events').select('id,status,deleted_at')
      .eq('id', req.params.eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event || event.status !== 'published' || event.deleted_at) return res.status(404).json({ message: 'Published event not found' });
    const { data, error } = await db().from('ticket_types').select('id,event_id,name,price,quantity_available,quantity_sold')
      .eq('event_id', req.params.eventId).order('price', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
};
