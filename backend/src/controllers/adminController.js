const { getSupabase } = require('../config/db');
const { generateAttendeesCSV } = require('../utils/csvExport');
const db = () => getSupabase();

async function assertEventAccess(eventId, user) {
  const { data: event, error } = await db().from('events')
    .select('id,organizer_id').eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) return { status: 404, message: 'Event not found' };
  if (user.role !== 'admin' && event.organizer_id !== user.userId) {
    return { status: 403, message: 'You cannot access attendees for this event' };
  }
  return { event };
}

exports.getDashboard = async (req, res, next) => {
  try {
    const [users, events, regs, upcoming, checkedRegistrations, checkedTickets, capacity] = await Promise.all([
      db().from('profiles').select('id', { count: 'exact', head: true }),
      db().from('events').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      db().from('registrations').select('id', { count: 'exact', head: true }),
      db().from('events').select('id', { count: 'exact', head: true })
        .eq('status', 'published').is('deleted_at', null).gte('event_date', new Date().toISOString()),
      db().from('registrations').select('id', { count: 'exact', head: true }).eq('checked_in', true),
      db().from('ticket_instances').select('id', { count: 'exact', head: true }).eq('status', 'used'),
      db().from('events').select('id,capacity').eq('status', 'published').is('deleted_at', null),
    ]);
    for (const result of [users, events, regs, upcoming, checkedRegistrations, checkedTickets, capacity]) if (result.error) throw result.error;

    const eventIds = (capacity.data || []).map((event) => event.id);
    let confirmedByEvent = [];
    if (eventIds.length) {
      const [registrationRows, paidTickets] = await Promise.all([
        db().from('registrations').select('event_id').in('event_id', eventIds).eq('status', 'confirmed'),
        db().from('ticket_instances').select('event_id').in('event_id', eventIds).neq('status', 'void'),
      ]);
      if (registrationRows.error) throw registrationRows.error;
      if (paidTickets.error) throw paidTickets.error;
      confirmedByEvent = [...(registrationRows.data || []), ...(paidTickets.data || [])];
    }
    const sold = confirmedByEvent.reduce((counts, row) => {
      counts[row.event_id] = (counts[row.event_id] || 0) + 1;
      return counts;
    }, {});
    const availableSeats = (capacity.data || []).reduce((total, event) =>
      total + Math.max(0, Number(event.capacity || 0) - (sold[event.id] || 0)), 0);

    res.json({
      totalUsers: users.count || 0, totalEvents: events.count || 0,
      totalRegistrations: regs.count || 0, upcomingEvents: upcoming.count || 0,
      availableSeats, checkedInAttendees: (checkedRegistrations.count || 0) + (checkedTickets.count || 0),
    });
  } catch (err) { next(err); }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const access = await assertEventAccess(eventId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const { data, error, count } = await db().from('registrations')
      .select('*,user:profiles!registrations_user_id_fkey(id,name,email),event:events!registrations_event_id_fkey(id,title)', { count: 'exact' })
      .eq('event_id', eventId).order('registered_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.set('X-Total-Count', String(count || 0));
    res.set('X-Page', String(page));
    res.set('X-Page-Limit', String(limit));
    res.set('X-Total-Pages', String(Math.ceil((count || 0) / limit)));
    // Keep the legacy array response so the existing dashboard remains compatible.
    res.json(data || []);
  } catch (err) { next(err); }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const access = await assertEventAccess(eventId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });

    const { data, error, count } = await db().from('registrations')
      .select('*,user:profiles!registrations_user_id_fkey(name,email),event:events!registrations_event_id_fkey(title)', { count: 'exact' })
      .eq('event_id', eventId).order('registered_at', { ascending: false }).range(0, 4999);
    if (error) throw error;
    if ((count || 0) > 5000) {
      return res.status(413).json({ message: 'This event has more than 5,000 registrations. Use the paginated attendee endpoint.' });
    }
    const csv = generateAttendeesCSV((data || []).map((r) => ({
      ...r, ticketNumber: r.ticket_number, registeredAt: r.registered_at,
      checkedIn: r.checked_in, checkedInAt: r.checked_in_at, user: r.user, event: r.event,
    })));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);
  } catch (err) { next(err); }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    let organizerEventIds = null;
    if (req.user.role === 'organizer') {
      const { data: owned, error } = await db().from('events').select('id')
        .eq('organizer_id', req.user.userId);
      if (error) throw error;
      organizerEventIds = (owned || []).map((event) => event.id);
      if (!organizerEventIds.length) {
        return res.json({ registrationsOverTime: [], registrationsPerEvent: [], checkInRate: 0, totalCheckedIn: 0, totalConfirmed: 0, capacityUtilization: [] });
      }
    }

    let registrationsQuery = db().from('registrations')
      .select('event_id,status,checked_in,registered_at');
    let paidTicketsQuery = db().from('ticket_instances')
      .select('event_id,status,created_at').neq('status', 'void');
    if (organizerEventIds) {
      registrationsQuery = registrationsQuery.in('event_id', organizerEventIds);
      paidTicketsQuery = paidTicketsQuery.in('event_id', organizerEventIds);
    }
    if (req.query.startDate && Number.isFinite(Date.parse(req.query.startDate))) {
      const startDate = new Date(req.query.startDate).toISOString();
      registrationsQuery = registrationsQuery.gte('registered_at', startDate);
      paidTicketsQuery = paidTicketsQuery.gte('created_at', startDate);
    }
    if (req.query.endDate && Number.isFinite(Date.parse(req.query.endDate))) {
      const endDate = new Date(`${req.query.endDate}T23:59:59.999Z`).toISOString();
      registrationsQuery = registrationsQuery.lte('registered_at', endDate);
      paidTicketsQuery = paidTicketsQuery.lte('created_at', endDate);
    }

    const [registrationsResult, ticketsResult] = await Promise.all([registrationsQuery, paidTicketsQuery]);
    if (registrationsResult.error) throw registrationsResult.error;
    if (ticketsResult.error) throw ticketsResult.error;

    const rows = [
      ...(registrationsResult.data || []).map((row) => ({
        event_id: row.event_id, status: row.status, checked_in: row.checked_in,
        registered_at: row.registered_at,
      })),
      ...(ticketsResult.data || []).map((row) => ({
        event_id: row.event_id, status: row.status === 'void' ? 'cancelled' : 'confirmed',
        checked_in: row.status === 'used', registered_at: row.created_at,
      })),
    ];

    const eventIds = [...new Set(rows.map((row) => row.event_id))];
    const eventMap = new Map();
    if (eventIds.length) {
      const { data: events, error } = await db().from('events')
        .select('id,title,capacity,organizer_id').in('id', eventIds);
      if (error) throw error;
      for (const event of events || []) eventMap.set(event.id, event);
    }

    const confirmed = rows.filter((row) => row.status === 'confirmed');
    const checked = confirmed.filter((row) => row.checked_in);
    const byDay = {};
    const byEvent = {};
    for (const row of rows) {
      const day = String(row.registered_at).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      if (row.status === 'confirmed') {
        const event = eventMap.get(row.event_id);
        byEvent[row.event_id] ||= {
          eventId: row.event_id, eventName: event?.title || 'Event', count: 0,
        };
        byEvent[row.event_id].count += 1;
      }
    }

    const counts = {};
    for (const row of confirmed) counts[row.event_id] = (counts[row.event_id] || 0) + 1;
    const capacityUtilization = [...eventMap.values()].map((event) => ({
      eventId: event.id, eventName: event.title, capacity: event.capacity,
      registered: counts[event.id] || 0,
      utilization: event.capacity ? ((counts[event.id] || 0) / event.capacity) * 100 : 0,
    })).sort((a, b) => b.utilization - a.utilization);

    res.json({
      registrationsOverTime: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
        .map(([_id, count]) => ({ _id, count })),
      registrationsPerEvent: Object.values(byEvent).sort((a, b) => b.count - a.count),
      checkInRate: confirmed.length ? checked.length / confirmed.length * 100 : 0,
      totalCheckedIn: checked.length, totalConfirmed: confirmed.length, capacityUtilization,
    });
  } catch (err) { next(err); }
};
