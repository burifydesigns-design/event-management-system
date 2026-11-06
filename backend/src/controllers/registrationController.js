const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { generateTicketToken } = require('../services/qrService');
const { sendRegistrationEmail } = require('../services/emailService');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { isValidUuid } = require('../config/supabase');

function generateTicketNumber() {
  return `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') return res.status(400).json({ message: 'Event is not published' });
    if (new Date(event.date) < new Date(new Date().toDateString())) return res.status(400).json({ message: 'Event is in the past' });

    const currentRegistrations = await Registration.countDocuments({ event: eventId, status: 'confirmed' });
    if (currentRegistrations >= event.capacity) return res.status(409).json({ message: 'Event is full' });

    const existingRegistration = await Registration.findOne({
      filter: { user: req.user.userId, event: eventId },
    });
    if (existingRegistration) return res.status(409).json({ message: 'Already registered for this event' });

    const ticketNumber = generateTicketNumber();
    const registration = await Registration.create({
      user: req.user.userId,
      event: eventId,
      ticketNumber,
    });

    const eventDetails = {
      name: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      city: event.city,
    };

    sendRegistrationEmail(req.user.email, eventDetails, ticketNumber).catch(() => {});

    res.status(201).json({
      ...registration,
      event: {
        id: event._id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        city: event.city,
      },
    });
  } catch (err) {
    next(err);
  }
};

const MY_EVENTS_TABS = ['upcoming', 'past', 'cancelled', 'all'];

exports.getMyEvents = async (req, res, next) => {
  try {
    const { page, limit, skip, error } = parsePagination(req.query, { defaultLimit: 10 });
    if (error) return res.status(400).json({ message: error });

    const tab = req.query.tab || 'all';
    if (!MY_EVENTS_TABS.includes(tab)) {
      return res.status(400).json({ message: 'Invalid tab. Use upcoming, past, cancelled, or all' });
    }

    if (!isValidUuid(req.user.userId)) {
      return res.status(401).json({ message: 'Invalid user' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { rows: all } = await Registration.find({
      filter: { user: req.user.userId },
      populate: 'event',
    });

    const eventDate = (r) => (r.event && r.event.date ? new Date(r.event.date) : null);
    const isUpcoming = (r) => r.status === 'confirmed' && eventDate(r) && eventDate(r) >= startOfToday;
    const isPast = (r) => r.status === 'confirmed' && (!eventDate(r) || eventDate(r) < startOfToday);
    const isCancelled = (r) => r.status === 'cancelled';

    const counts = {
      upcoming: all.filter(isUpcoming).length,
      past: all.filter(isPast).length,
      cancelled: all.filter(isCancelled).length,
    };

    const matchers = { upcoming: isUpcoming, past: isPast, cancelled: isCancelled, all: () => true };
    const filtered = all.filter(matchers[tab]).sort((a, b) => {
      const at = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const bt = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      if (bt !== at) return bt - at;
      return String(b._id || b.id).localeCompare(String(a._id || a.id));
    });

    const totalItems = filtered.length;
    const data = filtered.slice(skip, skip + limit);

    res.json({
      data,
      pagination: buildPaginationMeta({ page, limit, totalItems }),
      counts,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id, { populate: 'event' });
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    if (String(registration.user) !== String(req.user.userId) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(registration);
  } catch (err) {
    next(err);
  }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    if (String(registration.user) !== String(req.user.userId) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const event = await Event.findById(registration.event);
    if (event && new Date(event.date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Cannot cancel registration for past event' });
    }
    if (String(registration.user) === String(req.user.userId)) {
      await Registration.findByIdAndUpdate(registration.id || registration._id, { status: 'cancelled' });
    } else {
      await Registration.removeById(registration.id || registration._id);
    }
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    next(err);
  }
};
