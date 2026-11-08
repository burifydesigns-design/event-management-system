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

    const { data: ticketType, error: ticketError } = await db().from('ticket_types')
      .select('id,event_id,name,price,quantity_available,quantity_sold').eq('id', ticketTypeId).maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticketType || ticketType.event_id !== eventId) return res.status(404).json({ message: 'Ticket type not found for this event' });
    if (ticketType.quantity_available - ticketType.quantity_sold < qty) {
      return res.status(409).json({ message: 'Not enough tickets are available' });
    }

    const { data: event, error: eventError } = await db().from('events')
      .select('id,status,currency,registration_opens_at,registration_closes_at,deleted_at')
      .eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event || event.status !== 'published' || event.deleted_at) return res.status(404).json({ message: 'Event is not available for purchase' });
    const now = Date.now();
    if (event.registration_opens_at && now < Date.parse(event.registration_opens_at)) return res.status(409).json({ message: 'Registration has not opened' });
    if (event.registration_closes_at && now > Date.parse(event.registration_closes_at)) return res.status(409).json({ message: 'Registration is closed' });

    const idempotencyKey = String(req.headers['idempotency-key'] || randomUUID()).slice(0, 200);
    const totalAmount = Number(ticketType.price) * qty;
    const { data: order, error: orderError } = await db().from('orders').insert({
      attendee_id: req.user.userId, event_id: eventId, total_amount: totalAmount,
      currency: event.currency || 'KES', status: 'pending', idempotency_key: idempotencyKey,
    }).select('*').single();
    if (orderError) {
      if (orderError.code === '23505') return res.status(409).json({ message: 'This checkout request has already been submitted' });
      throw orderError;
    }

    const { error: itemError } = await db().from('order_items').insert({
      order_id: order.id, ticket_type_id: ticketType.id, description: ticketType.name,
      quantity: qty, unit_price: ticketType.price,
    });
    if (itemError) throw itemError;

    const { data: payment, error: paymentError } = await db().from('payments').insert({
      order_id: order.id, provider: process.env.PAYMENT_PROVIDER || 'unconfigured',
      amount: totalAmount, currency: event.currency || 'KES', status: 'pending',
      idempotency_key: idempotencyKey,
    }).select('id,order_id,provider,amount,currency,status,created_at').single();
    if (paymentError) throw paymentError;

    // No ticket is issued here. A verified provider webhook must transition the payment
    // to succeeded and issue tickets atomically before a ticket becomes usable.
    res.status(202).json({ order, payment, message: 'Order created and awaiting verified payment. No ticket has been issued yet.' });
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
