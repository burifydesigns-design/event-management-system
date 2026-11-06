const Event = require('../models/Event');
const Registration = require('../models/Registration');
const CoordinatorAssignment = require('../models/CoordinatorAssignment');
const { atomicCheckIn } = require('../services/ticketService');
const { isValidUuid } = require('../config/supabase');

async function canScanEvent(user, eventId) {
  if (!isValidUuid(eventId)) return false;
  const event = await Event.findById(eventId);
  if (!event) return false;
  if (user.role === 'admin') return true;
  if (String(event.organizer) === String(user.userId || user._id)) return true;
  if (user.role === 'coordinator') {
    const assignment = await CoordinatorAssignment.findOne({
      filter: { coordinator: user.userId || user._id, event: eventId },
    });
    return !!assignment;
  }
  return false;
}

exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;
    if (!qrToken || !eventId) {
      return res.status(400).json({ valid: false, message: 'QR token and event ID are required' });
    }

    const authorized = await canScanEvent(req.user, eventId);
    if (!authorized) {
      return res.status(403).json({ valid: false, message: 'Not authorized to scan tickets for this event' });
    }

    const result = await atomicCheckIn({
      qrToken,
      eventId,
      staffUserId: req.user.userId,
      staffRole: req.user.role,
    });

    const statusMap = {
      valid: 200,
      already_used: 400,
      invalid: 404,
      cancelled: 400,
      wrong_event: 400,
    };

    const messages = {
      valid: 'Ticket valid — attendee admitted',
      already_used: 'Ticket already checked in',
      invalid: 'Ticket not found or invalid',
      cancelled: 'Ticket is cancelled or refunded',
      wrong_event: 'Ticket is for a different event',
    };

    res.status(statusMap[result.result] || 200).json({
      valid: result.result === 'valid',
      result: result.result,
      ticketNumber: result.registration ? result.registration.ticketNumber : null,
      checkedIn: result.registration ? result.registration.checkedIn : false,
      message: messages[result.result],
    });
  } catch (err) {
    next(err);
  }
};

exports.scanEvents = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      if (req.user.role === 'organizer') {
        query.organizer = req.user.userId;
      } else if (req.user.role === 'coordinator') {
        const assignments = await CoordinatorAssignment.find({
          filter: { coordinator: req.user.userId },
          select: 'event',
        });
        const eventIds = assignments.map((a) => a.event);
        if (eventIds.length === 0) {
          return res.json({ data: [], pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } });
        }
        query._id = { $in: eventIds };
      } else {
        return res.status(403).json({ message: 'Not authorized to access scanner' });
      }
    }

    query.status = 'published';

    const { rows: events } = await Event.find({
      filter: query,
      select: 'title date time location city capacity status organizer',
      sort: { date: 1, _id: 1 },
    });

    const eventIds = events.map((e) => e._id);
    let countMap = {};
    if (eventIds.length > 0) {
    const { rows: regs } = await Registration.find({
      filter: { event: { $in: eventIds }, status: 'confirmed' },
      select: 'event checked_in',
    });
      countMap = {};
      for (const r of regs) {
        if (!countMap[r.event]) countMap[r.event] = { confirmed: 0, checkedIn: 0 };
        countMap[r.event].confirmed += 1;
        if (r.checkedIn === true) countMap[r.event].checkedIn += 1;
      }
    }

    const data = events.map((e) => {
      const c = countMap[String(e._id)] || { confirmed: 0, checkedIn: 0 };
      return {
        id: e._id,
        title: e.title,
        date: e.date,
        time: e.time,
        location: e.location,
        city: e.city,
        capacity: e.capacity,
        status: e.status,
        confirmedRegistrations: c.confirmed,
        checkedInRegistrations: c.checkedIn,
      };
    });

    res.json({ data, pagination: { page: 1, limit: data.length, totalItems: data.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });
  } catch (err) {
    next(err);
  }
};

exports.scanHistory = async (req, res, next) => {
  try {
    const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
    const pg = parsePagination(req.query, { defaultLimit: 20 });
    if (pg.error) return res.status(400).json({ message: pg.error });

    const CheckInLog = require('../models/CheckInLog');

    let match = {};
    if (req.user.role === 'coordinator') {
      match.scannedBy = req.user.userId;
    } else if (req.user.role === 'organizer') {
      const events = await Event.find({ filter: { organizer: req.user.userId }, select: '_id' });
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    }

    const totalItems = await CheckInLog.countDocuments(match);
    const { rows: logs } = await CheckInLog.find({
      filter: match,
      populate: [{ path: 'scannedBy', fields: 'name email role' }],
      sort: { scannedAt: -1, _id: -1 },
      skip: pg.skip,
      limit: pg.limit,
    });

    res.json({
      data: logs,
      pagination: buildPaginationMeta({ page: pg.page, limit: pg.limit, totalItems }),
    });
  } catch (err) {
    next(err);
  }
};
