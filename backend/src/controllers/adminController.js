const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { generateAttendeesCSV } = require('../utils/csvExport');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { isValidUuid } = require('../config/supabase');

exports.getAllEvents = async (req, res, next) => {
  try {
    const { page, limit, skip, error } = parsePagination(req.query);
    if (error) return res.status(400).json({ message: error });

    if (req.query.status !== undefined) {
      const allowed = ['draft', 'published', 'cancelled'];
      if (!allowed.includes(req.query.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
    }

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const totalItems = await Event.countDocuments(filter);
    const { rows } = await Event.find({
      filter,
      sort: { createdAt: -1, _id: -1 },
      skip,
      limit,
    });

    const data = await Promise.all(
      rows.map(async (e) => ({
        ...e,
        registeredCount: await Registration.countDocuments({ event: e._id || e.id }),
      }))
    );

    res.json({ data, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const totalRegistrations = await Registration.countDocuments();
    const upcomingEvents = await Event.countDocuments({
      status: 'published',
      date: { $gte: new Date() },
    });

    const { rows: allEvents } = await Event.find({ select: 'capacity' });
    const availableSeats = allEvents.reduce((sum, e) => sum + (e.capacity || 0), 0);

    const checkedInAttendees = await Registration.countDocuments({ checkedIn: true });

    res.json({
      totalUsers,
      totalEvents,
      totalRegistrations,
      upcomingEvents,
      availableSeats,
      checkedInAttendees,
    });
  } catch (err) {
    next(err);
  }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId || !isValidUuid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId, { select: '_id organizer' });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to view this event' });
    }

    const { page, limit, skip, error } = parsePagination(req.query);
    if (error) return res.status(400).json({ message: error });

    const totalItems = await Registration.countDocuments({ event: eventId });
    const { rows: attendees } = await Registration.find({
      filter: { event: eventId },
      populate: [{ path: 'user', fields: 'name email' }],
      sort: { registeredAt: -1 },
      skip,
      limit,
    });

    res.json({
      data: attendees,
      pagination: buildPaginationMeta({ page, limit, totalItems }),
    });
  } catch (err) {
    next(err);
  }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId || !isValidUuid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to export this event' });
    }

    const { rows: registrations } = await Registration.find({
      filter: { event: eventId },
      populate: [
        { path: 'user', fields: 'name email' },
        { path: 'event', fields: 'title' },
      ],
      sort: { registeredAt: -1 },
    });

    const csv = generateAttendeesCSV(registrations);

    const safeEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `attendees-${safeEventId}-${dateStamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

function dateRangeMatch(startDate, endDate) {
  const match = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) match.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      match.$lte = end;
    }
  }
  return Object.keys(match).length > 0 ? match : null;
}

exports.getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const rangeMatch = dateRangeMatch(startDate, endDate);

    const registrationMatch = {};
    if (rangeMatch) registrationMatch.registeredAt = rangeMatch;

    let organizerEventIds = null;
    if (req.user.role === 'organizer') {
      organizerEventIds = await Event.distinct('_id', { organizer: req.user.userId });
      if (organizerEventIds.length === 0) {
        return res.json({
          registrationsOverTime: [],
          registrationsPerEvent: [],
          checkInRate: 0,
          totalCheckedIn: 0,
          totalConfirmed: 0,
          capacityUtilization: [],
        });
      }
      registrationMatch.event = { $in: organizerEventIds };
    }

    const { rows: registrations } = await Registration.find({
      filter: registrationMatch,
      select: 'registered_at event status checked_in',
    });

    const overTimeMap = {};
    for (const r of registrations) {
      const day = new Date(r.registeredAt).toISOString().slice(0, 10);
      overTimeMap[day] = (overTimeMap[day] || 0) + 1;
    }
    const registrationsOverTime = Object.entries(overTimeMap)
      .map(([_id, count]) => ({ _id, count }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const confirmedRegs = registrations.filter((r) => r.status === 'confirmed');
    const perEventMap = {};
    for (const r of confirmedRegs) {
      perEventMap[r.event] = (perEventMap[r.event] || 0) + 1;
    }
    const eventIds = Object.keys(perEventMap);
    const events = eventIds.length
      ? (await Event.find({ filter: { _id: { $in: eventIds } }, select: '_id title' })).rows
      : [];
    const eventMap = {};
    for (const e of events) eventMap[e._id] = e.title;
    const registrationsPerEvent = Object.entries(perEventMap)
      .map(([eventId, count]) => ({ _id: eventId, eventName: eventMap[eventId] || '', count }))
      .sort((a, b) => b.count - a.count);

    const totalConfirmed = confirmedRegs.length;
    const totalCheckedIn = confirmedRegs.filter((r) => r.checkedIn === true).length;
    const checkInRate = totalConfirmed > 0 ? (totalCheckedIn / totalConfirmed) * 100 : 0;

    const { rows: capacityEvents } = await Event.find({
      filter: organizerEventIds ? { _id: { $in: organizerEventIds } } : {},
      select: '_id title capacity',
    });
    const regCountByEvent = {};
    const { rows: capacityRegs } = await Registration.find({ filter: {}, select: 'event' });
    for (const r of capacityRegs) {
      regCountByEvent[r.event] = (regCountByEvent[r.event] || 0) + 1;
    }
    const capacityUtilization = capacityEvents.map((e) => {
      const registered = regCountByEvent[e._id] || 0;
      const utilization = e.capacity === 0 ? 0 : (registered / e.capacity) * 100;
      return { _id: e._id, eventName: e.title, capacity: e.capacity, registered, utilization };
    }).sort((a, b) => b.utilization - a.utilization);

    res.json({
      registrationsOverTime,
      registrationsPerEvent,
      checkInRate,
      totalCheckedIn,
      totalConfirmed,
      capacityUtilization,
    });
  } catch (err) {
    next(err);
  }
};
