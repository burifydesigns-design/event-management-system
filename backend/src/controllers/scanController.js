const { getSupabase } = require('../config/db');
const db = () => getSupabase();

// Conditional UPDATE is the concurrency guard: only one scan can transition a valid ticket.
exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body || {};
    if (typeof qrToken !== 'string' || !qrToken.trim() || typeof eventId !== 'string' || !eventId.trim()) {
      return res.status(400).json({ valid: false, message: 'qrToken and eventId are required' });
    }

    const { data: ticket, error: lookupError } = await db()
      .from('ticket_instances').select('id,event_id,status').eq('qr_token', qrToken.trim()).maybeSingle();
    if (lookupError) throw lookupError;
    if (!ticket) return res.status(404).json({ valid: false, message: 'Ticket not found' });
    if (ticket.event_id !== eventId) return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });

    const { data: event, error: eventError } = await db().from('events')
      .select('organizer_id').eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return res.status(404).json({ valid: false, message: 'Event not found' });
    if (req.user.role === 'organizer' && event.organizer_id !== req.user.userId) {
      return res.status(403).json({ valid: false, message: 'You are not assigned to this event' });
    }
    if (req.user.role === 'coordinator') {
      const { data: membership, error: membershipError } = await db().from('organizer_members')
        .select('id').eq('organizer_id', event.organizer_id).eq('member_id', req.user.userId)
        .in('role', ['owner', 'manager', 'check_in']).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({ valid: false, message: 'You are not assigned to this event' });
    }
    if (ticket.status !== 'valid') {
      return res.status(409).json({ valid: false, message: ticket.status === 'used' ? 'Ticket already used' : 'Ticket is void' });
    }

    const { data: updated, error } = await db().from('ticket_instances')
      .update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: req.user.userId })
      .eq('id', ticket.id).eq('status', 'valid')
      .select('id,status,scanned_at,scanned_by').maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ valid: false, message: 'Ticket has already been checked in' });

    res.json({ valid: true, message: 'Ticket valid — attendee admitted', ticket: updated });
  } catch (err) {
    next(err);
  }
};
