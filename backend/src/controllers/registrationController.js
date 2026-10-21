const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { generateTicketToken } = require('../services/qrService');
const { sendRegistrationEmail } = require('../services/emailService');

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

    // The JWT payload carries `userId` (see authController.signToken); using
    // `req.user._id` here was always undefined and dropped the user filter.
    const existingRegistration = await Registration.findOne({ user: req.user.userId, event: eventId });
    if (existingRegistration) return res.status(409).json({ message: 'Already registered for this event' });

    const ticketNumber = generateTicketNumber();
    const registration = await Registration.create({
      user: req.user.userId,
      event: eventId,
      ticketNumber,
    });

    await event.populate('organizer', 'name email');
    const eventDetails = {
      name: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      city: event.city,
    };

    sendRegistrationEmail(req.user.email, eventDetails, ticketNumber).catch(() => {});

    res.status(201).json({
      ...registration.toObject(),
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

/**
 * My Events list with server-side tabs and pagination.
 *
 * Query params:
 *  - tab: 'upcoming' | 'past' | 'cancelled' | 'all' (default: 'all')
 *  - page / limit: standard pagination params
 *
 * Upcoming/past classification happens server-side against the referenced
 * event's date so counts and pages stay accurate for the authenticated user
 * only (the `user` match is always applied before any pagination).
 */
exports.getMyEvents = async (req, res, next) => {
  try {
    const { page, limit, skip, error } = parsePagination(req.query, { defaultLimit: 10 });
    if (error) return res.status(400).json({ message: error });

    const tab = req.query.tab || 'all';
    if (!MY_EVENTS_TABS.includes(tab)) {
      return res.status(400).json({ message: 'Invalid tab. Use upcoming, past, cancelled, or all' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({ message: 'Invalid user' });
    }
    const userObjectId = new mongoose.Types.ObjectId(String(req.user.userId));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const baseMatch = { user: userObjectId };
    const tabMatch = {
      upcoming: { status: 'confirmed', 'eventDoc.date': { $gte: startOfToday } },
      past: {
        status: 'confirmed',
        $or: [
          { 'eventDoc.date': { $lt: startOfToday } },
          { 'eventDoc.date': null },
        ],
      },
      cancelled: { status: 'cancelled' },
      all: {},
    }[tab];

    const lookupStage = {
      $lookup: {
        from: 'events',
        localField: 'event',
        foreignField: '_id',
        as: 'eventDoc',
      },
    };
    const unwindStage = {
      $unwind: { path: '$eventDoc', preserveNullAndEmptyArrays: true },
    };

    // Total for the requested tab; the user match always precedes pagination.
    const countResult = await Registration.aggregate([
      { $match: baseMatch },
      lookupStage,
      unwindStage,
      { $match: tabMatch },
      { $count: 'totalItems' },
    ]);
    const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;

    // Page data shaped like the previous populate('event') response so
    // existing consumers keep working.
    const data = await Registration.aggregate([
      { $match: baseMatch },
      lookupStage,
      unwindStage,
      { $match: tabMatch },
      { $sort: { registeredAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $addFields: { event: '$eventDoc' } },
      { $project: { eventDoc: 0 } },
    ]);

    // Per-tab counts so the UI can render tab badges in one round trip.
    const countsResult = await Registration.aggregate([
      { $match: baseMatch },
      lookupStage,
      unwindStage,
      {
        $group: {
          _id: null,
          upcoming: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$status', 'confirmed'] },
                  { $gte: ['$eventDoc.date', startOfToday] },
                ] },
                1,
                0,
              ],
            },
          },
          past: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$status', 'confirmed'] },
                  { $or: [
                    { $lt: ['$eventDoc.date', startOfToday] },
                    { $eq: ['$eventDoc.date', null] },
                  ] },
                ] },
                1,
                0,
              ],
            },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]);
    const counts = countsResult.length > 0
      ? {
          upcoming: countsResult[0].upcoming,
          past: countsResult[0].past,
          cancelled: countsResult[0].cancelled,
        }
      : { upcoming: 0, past: 0, cancelled: 0 };

    res.json({
      data,
      pagination: buildPaginationMeta({ page, limit, totalItems }),
      counts,
    });
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
      registration.status = 'cancelled';
      await registration.save();
    } else {
      await registration.deleteOne();
    }
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    next(err);
  }
};
