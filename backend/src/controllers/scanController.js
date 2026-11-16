const { getSupabase } = require('../config/db');
const db = () => getSupabase();

async function assertEventAssignment(eventId, user) {
  const { data: event, error } = await db().from('events')
    .select('id,organizer_id').eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) return { status: 404, message: 'Event not found' };
  if (user.role === 'organizer' && event.organizer_id !== user.userId) {
    return { status: 403, message: 'You are not assigned to this event' };
  }
  if (user.role === 'coordinator') {
    const { data: membership, error: membershipError } = await db().from('organizer_members')
      .select('id').eq('organizer_id', event.organizer_id).eq('member_id', user.userId)
      .in('role', ['owner', 'manager', 'check_in']).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return { status: 403, message: 'You are not assigned to this event' };
  }
  return { event };
}

// Paid ticket instances and legacy free registrations both support check-in.
// Conditional updates ensure a ticket can only be consumed once under concurrency.
exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body || {};
    if (typeof qrToken !== 'string' || !qrToken.trim() ||
        typeof eventId !== 'string' || !eventId.trim()) {
      return res.status(400).json({ valid: false, message: 'qrToken and eventId are required' });
    }

    const token = qrToken.trim();
    const [ticketResult, registrationResult] = await Promise.all([
      db().from('ticket_instances').select('id,event_id,status')
        .eq('qr_token', token).maybeSingle(),
      db().from('registrations').select('id,event_id,ticket_number,status,checked_in')
        .eq('ticket_number', token).maybeSingle(),
    ]);
    if (ticketResult.error) throw ticketResult.error;
    if (registrationResult.error) throw registrationResult.error;

    const ticket = ticketResult.data;
    const registration = registrationResult.data;
    if (!ticket && !registration) {
      return res.status(404).json({ valid: false, message: 'Ticket not found' });
    }
    const actualEventId = ticket ? ticket.event_id : registration.event_id;
    if (actualEventId !== eventId) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }

    const assignment = await assertEventAssignment(eventId, req.user);
    if (assignment.status) return res.status(assignment.status).json({ valid: false, message: assignment.message });

    if (ticket) {
      if (ticket.status !== 'valid') {
        return res.status(409).json({ valid: false, message: ticket.status === 'used' ? 'Ticket already used' : 'Ticket is void' });
      }
      const { data: updated, error } = await db().from('ticket_instances')
        .update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: req.user.userId })
        .eq('id', ticket.id).eq('status', 'valid')
        .select('id,status,scanned_at,scanned_by').maybeSingle();
      if (error) throw error;
      if (!updated) return res.status(409).json({ valid: false, message: 'Ticket has already been checked in' });
      return res.json({ valid: true, message: 'Ticket valid — attendee admitted', ticket: updated });
    }

    if (registration.status !== 'confirmed') {
      return res.status(409).json({ valid: false, message: 'Registration is not active' });
    }
    if (registration.checked_in) {
      return res.status(409).json({ valid: false, message: 'Ticket already used' });
    }
    const { data: updated, error } = await db().from('registrations')
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', registration.id).eq('status', 'confirmed').eq('checked_in', false)
      .select('id,ticket_number,checked_in,checked_in_at').maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ valid: false, message: 'Ticket has already been checked in' });
    return res.json({ valid: true, message: 'Ticket valid — attendee admitted', ticket: updated });
  } catch (err) {
    next(err);
  }
};
