const { randomBytes } = require('crypto');
const { getSupabase } = require('../config/db');
const db = () => getSupabase();

exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.body || {};
    if (typeof eventId !== 'string' || !eventId.trim()) {
      return res.status(400).json({ message: 'eventId is required' });
    }

    const ticketNumber = `EVT-${randomBytes(12).toString('hex').toUpperCase()}`;
    const { data, error } = await db().rpc('register_free_event', {
      p_user_id: req.user.userId,
      p_event_id: eventId,
      p_ticket_number: ticketNumber,
    });
    if (error) {
      if (error.code === 'P0002') return res.status(404).json({ message: 'Published free event not found' });
      if (error.code === 'P0001') return res.status(409).json({ message: error.message });
      if (error.code === '22023') return res.status(400).json({ message: error.message });
      throw error;
    }

    const registration = data && data.registration;
    if (!registration) throw new Error('Registration RPC returned no registration');
    const { data: event, error: eventError } = await db().from('events').select('*')
      .eq('id', eventId).single();
    if (eventError) throw eventError;
    res.status(data.replayed ? 200 : 201).json({
      ...registration,
      event: { ...event, date: event.event_date, time: event.event_time },
      replayed: Boolean(data.replayed),
    });
  } catch (err) { next(err); }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const { data, error } = await db().from('registrations')
      .select('*,event:events(*)').eq('user_id', req.user.userId)
      .eq('status', 'confirmed').order('registered_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map((r) => ({
      ...r,
      event: r.event ? { ...r.event, date: r.event.event_date, time: r.event.event_time } : r.event,
    })));
  } catch (err) { next(err); }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    const { data: registration, error } = await db().from('registrations')
      .select('id,user_id,event_id,status,event:events(event_date,organizer_id)')
      .eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    const isAdmin = req.user.role === 'admin';
    const isAttendee = registration.user_id === req.user.userId;
    const isEventOwner = req.user.role === 'organizer' &&
      registration.event && registration.event.organizer_id === req.user.userId;
    if (!isAdmin && !isAttendee && !isEventOwner) {
      return res.status(403).json({ message: 'Not authorized to cancel this registration' });
    }
    if (registration.event && new Date(registration.event.event_date) < new Date()) {
      return res.status(400).json({ message: 'Cannot cancel registration for a past event' });
    }
    const { error: updateError } = await db().from('registrations')
      .update({ status: 'cancelled', checked_in: false, checked_in_at: null })
      .eq('id', req.params.id).eq('status', 'confirmed');
    if (updateError) throw updateError;
    res.json({ message: 'Registration cancelled' });
  } catch (err) { next(err); }
};
