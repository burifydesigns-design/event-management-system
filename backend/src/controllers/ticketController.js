const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const TicketInstance = require('../models/TicketInstance');
const { issueTicket, atomicCheckIn, generateTicketToken } = require('../services/ticketService');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * Check if the authenticated user is staff for the given event.
 * Staff = admin, event organizer, or assigned coordinator.
 */
async function isStaffForEvent(user, event) {
  if (!user || !event) return false;
  if (user.role === 'admin') return true;
  if (String(event.organizer) === String(user.userId || user._id)) return true;
  // Coordinator must be assigned to this event.
  if (user.role === 'coordinator') {
    const CoordinatorAssignment = require('../models/CoordinatorAssignment');
    const assignment = await CoordinatorAssignment.findOne({
      coordinator: user.userId || user._id,
      event: event._id,
    });
    return !!assignment;
  }
  return false;
}

/**
 * POST /api/tickets/issue — Issue a ticket for an attendee to an event.
 * Organizer/admin only. Idempotent. Payment-gated for paid orders.
 */
exports.issueTicket = async (req, res, next) => {
  try {
    const { userId, eventId, ticketTypeId, orderId } = req.body;

    if (!userId || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'userId and valid eventId are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Authorization: organizer of event or admin.
    const isStaff = await isStaffForEvent(req.user, event);
    if (!isStaff) {
      return res.status(403).json({ message: 'Not authorized to issue tickets for this event' });
    }

    // Cannot issue for cancelled events.
    if (event.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot issue tickets for a cancelled event' });
    }

    const result = await issueTicket({
      userId,
      eventId,
      ticketTypeId: ticketTypeId || null,
      orderId: orderId || null,
    });

    res.status(201).json({
      message: result.created ? 'Ticket issued' : 'Ticket already exists',
      ticket: {
        id: result.ticket._id,
        ticketNumber: result.ticket.ticketNumber,
        qrToken: result.ticket.qrToken,
        status: result.ticket.status,
        checkedIn: result.ticket.checkedIn,
        event: result.ticket.event,
        user: result.ticket.user,
        emailSent: result.ticket.emailSent,
      },
      created: result.created,
    });
  } catch (err) {
    if (err.message === 'Payment not confirmed') {
      return res.status(400).json({ message: 'Payment must be confirmed before issuing a ticket' });
    }
    next(err);
  }
};

/**
 * GET /api/tickets/:id — Retrieve a ticket (registration) when authorized.
 */
exports.getTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    const registration = await Registration.findById(req.params.id)
      .populate('event', 'title date time location city status capacity organizer')
      .populate('user', 'name email role')
      .populate('ticketType', 'name price');

    if (!registration) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const event = registration.event;
    const isOwner = String(registration.user._id) === String(req.user.userId);
    const isStaff = await isStaffForEvent(req.user, event);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized to view this ticket' });
    }

    res.json({
      ticket: {
        id: registration._id,
        ticketNumber: registration.ticketNumber,
        qrToken: registration.qrToken,
        status: registration.status,
        checkedIn: registration.checkedIn,
        checkedInAt: registration.checkedInAt,
        checkedInBy: registration.checkedInBy,
        emailSent: registration.emailSent,
        emailSentAt: registration.emailSentAt,
        registeredAt: registration.registeredAt,
        event: {
          id: event._id,
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          city: event.city,
          status: event.status,
          capacity: event.capacity,
        },
        user: {
          id: registration.user._id,
          name: registration.user.name,
          email: registration.user.email,
        },
        ticketType: registration.ticketType
          ? { id: registration.ticketType._id, name: registration.ticketType.name, price: registration.ticketType.price }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/tickets/:id/qr — QR image for an authorized ticket.
 */
exports.getTicketQR = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    const registration = await Registration.findById(req.params.id).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const event = registration.event;
    const isOwner = String(registration.user) === String(req.user.userId);
    const isStaff = await isStaffForEvent(req.user, event);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized to view this ticket' });
    }

    if (!registration.qrToken) {
      return res.status(404).json({ message: 'QR token not found for this ticket' });
    }

    const qrCode = await require('../services/qrService').generateQRImage(registration.qrToken);
    res.json({ qrCode, ticketNumber: registration.ticketNumber, qrToken: registration.qrToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/validate — Pre-check a ticket before check-in (scanner).
 * Returns outcome without mutating state.
 */
exports.validateTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;
    if (!qrToken || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ valid: false, message: 'Valid QR token and event ID are required' });
    }

    const registration = await Registration.findOne({ qrToken }).populate('event');
    if (!registration) {
      return res.status(404).json({ valid: false, message: 'Ticket not found' });
    }

    const event = registration.event;
    if (String(event._id) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }

    const isStaff = await isStaffForEvent(req.user, event);
    if (!isStaff) {
      return res.status(403).json({ valid: false, message: 'Not authorized to validate tickets for this event' });
    }

    if (registration.status === 'cancelled' || registration.status === 'refunded') {
      return res.status(400).json({
        valid: false,
        message: 'Ticket is cancelled or refunded',
        ticketNumber: registration.ticketNumber,
        checkedIn: registration.checkedIn,
      });
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({ valid: false, message: 'Ticket is not active' });
    }

    if (registration.checkedIn) {
      return res.status(200).json({
        valid: false,
        message: 'Attendee already checked in',
        ticketNumber: registration.ticketNumber,
        checkedIn: true,
        checkedInAt: registration.checkedInAt,
      });
    }

    res.json({
      valid: true,
      ticketNumber: registration.ticketNumber,
      status: registration.status,
      checkedIn: false,
      event: { id: event._id, title: event.title },
      attendee: { id: registration.user._id, name: registration.user.name },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/check-in — Atomically check in a ticket (scanner).
 * Concurrency-safe: findOneAndUpdate with checkedIn:false prevents double admission.
 */
exports.checkInTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;
    if (!qrToken || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Valid QR token and event ID are required' });
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

    res.status(statusMap[result.result] || 200).json({
      result: result.result,
      ticketNumber: result.registration ? result.registration.ticketNumber : null,
      checkedIn: result.registration ? result.registration.checkedIn : false,
      message: result.result === 'valid'
        ? 'Attendee checked in successfully'
        : result.result === 'already_used'
          ? 'Attendee already checked in'
          : result.result === 'wrong_event'
            ? 'Ticket is for a different event'
            : result.result === 'cancelled'
              ? 'Ticket is cancelled or refunded'
              : 'Ticket not found or invalid',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/resend-email — Resend ticket email (owner or staff).
 */
exports.resendTicketEmail = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    const registration = await Registration.findById(req.params.id).populate('user event');
    if (!registration) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const event = registration.event;
    const isOwner = String(registration.user._id) === String(req.user.userId);
    const isStaff = await isStaffForEvent(req.user, event);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized to resend this ticket' });
    }

    const { resendTicketEmail } = require('../services/emailService');
    const emailLog = await resendTicketEmail(registration._id);

    res.json({ message: 'Ticket email queued', emailLogId: emailLog._id });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/tickets/my — List the authenticated user's tickets.
 */
exports.myTickets = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query, { defaultLimit: 20 });
    if (pg.error) return res.status(400).json({ message: pg.error });

    const totalItems = await Registration.countDocuments({ user: req.user.userId });
    const tickets = await Registration.find({ user: req.user.userId })
      .populate('event', 'title date time location city status')
      .populate('ticketType', 'name price')
      .sort({ registeredAt: -1, _id: -1 })
      .skip(pg.skip)
      .limit(pg.limit);

    res.json({
      data: tickets,
      pagination: buildPaginationMeta({ page: pg.page, limit: pg.limit, totalItems }),
    });
  } catch (err) {
    next(err);
  }
};
