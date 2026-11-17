const { getSupabase } = require('../config/db');
const db = () => getSupabase();

// Organizer/admin: count issued tickets (paid orders only) and successful check-ins.
exports.salesForEvent = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    const { data: event, error: eventError } = await db()
      .from('events').select('id,organizer_id').eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (req.user.role !== 'admin' && event.organizer_id !== req.user.userId) {
      return res.status(403).json({ message: 'You cannot view sales for this event' });
    }

    const [totalResult, usedResult] = await Promise.all([
      db().from('ticket_instances').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      db().from('ticket_instances').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'used'),
    ]);
    if (totalResult.error) throw totalResult.error;
    if (usedResult.error) throw usedResult.error;
    const ticketsSold = totalResult.count || 0;
    const ticketsScanned = usedResult.count || 0;
    res.json({ eventId, ticketsSold, ticketsScanned, ticketsNotYetScanned: ticketsSold - ticketsScanned });
  } catch (err) {
    next(err);
  }
};
