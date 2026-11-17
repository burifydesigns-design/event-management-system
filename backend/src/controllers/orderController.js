const { randomUUID } = require('crypto');
const { getSupabase } = require('../config/db');
const db = () => getSupabase();

exports.createOrder = async (req, res, next) => {
  try {
    const { eventId, ticketTypeId, quantity } = req.body || {};
    const qty = Number(quantity);
    if (!eventId || !ticketTypeId || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      return res.status(400).json({ message: 'eventId, ticketTypeId and quantity (1–10) are required' });
    }

    // A client-generated key is reused for retries of the same checkout attempt.
    const suppliedKey = req.headers['idempotency-key'];
    const idempotencyKey = String(suppliedKey || randomUUID()).trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return res.status(400).json({ message: 'A valid Idempotency-Key header is required' });
    }

    const { data, error } = await db().rpc('create_order_with_ticket_hold', {
      p_attendee_id: req.user.userId,
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_quantity: qty,
      p_idempotency_key: idempotencyKey,
      p_payment_provider: process.env.PAYMENT_PROVIDER || 'unconfigured',
    });

    if (error) {
      if (error.code === 'P0002') return res.status(404).json({ message: error.message });
      if (error.code === 'P0001') return res.status(409).json({ message: error.message });
      if (error.code === '22023') return res.status(400).json({ message: error.message });
      throw error;
    }

    const status = data && data.replayed ? 200 : 202;
    return res.status(status).json({
      order: data.order,
      payment: data.payment,
      replayed: Boolean(data.replayed),
      holdExpiresAt: data.order && data.order.hold_expires_at,
      message: 'Ticket inventory is held for 10 minutes while payment is pending. No ticket is issued until payment is verified.',
    });
  } catch (err) {
    next(err);
  }
};

exports.myTickets = async (req, res, next) => {
  try {
    const { data, error } = await db().from('ticket_instances')
      .select('*,event:events(id,title,event_date,event_time,location,city),ticket_type:ticket_types(id,name,price)')
      .eq('attendee_id', req.user.userId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
};
