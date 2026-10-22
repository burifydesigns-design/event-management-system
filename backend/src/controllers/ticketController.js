const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { generateQRImage } = require('../services/qrService');

// Organizer creates a ticket type for one of their events
exports.createTicketType = async (req, res, next) => {
  try {
    const ticketType = await TicketType.create(req.body);
    res.status(201).json(ticketType);
  } catch (err) {
    next(err);
  }
};

exports.listTicketTypesForEvent = async (req, res, next) => {
  try {
    const ticketTypes = await TicketType.find({ event: req.params.eventId });
    res.json(ticketTypes);
  } catch (err) {
    next(err);
  }
};

function isStaffForEvent(user, event) {
  if (!user || !event) return false;
  return user.role === 'admin' || String(event.organizer) === String(user.userId || user._id);
}

// GET /api/tickets/:id — retrieve a ticket (registration) when authorized
exports.getTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }
    const registration = await Registration.findById(req.params.id)
      .populate('event', 'title date time location city status capacity organizer')
      .populate('user', 'name email role');
    if (!registration) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const event = registration.event;
    const isOwner = String(registration.user._id) === String(req.user.userId);
    if (!isOwner && !isStaffForEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to view this ticket' });
    }
    res.json({
      ticket: {
        id: registration._id,
        ticketNumber: registration.ticketNumber,
        status: registration.status,
        checkedIn: registration.checkedIn,
        checkedInAt: registration.checkedInAt,
        registeredAt: registration.registeredAt,
        event: {
          id: event._id,
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          city: event.city,
          status: event.status,
        },
        user: {
          id: registration.user._id,
          name: registration.user.name,
          email: registration.user.email,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:id/qr — QR representation of an authorized ticket
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
    const isOwner = String(registration.user._id) === String(req.user.userId);
    if (!isOwner && !isStaffForEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to view this ticket' });
    }
    // The QR payload carries only the ticket identifier — no passwords, tokens, or PII.
    const qrPayload = registration.ticketNumber;
    const qrCode = await generateQRImage(qrPayload);
    res.json({ qrCode, ticketNumber: registration.ticketNumber });
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/validate — validate a ticket for check-in (organizer/admin)
exports.validateTicket = async (req, res, next) => {
  try {
    const { ticketNumber, eventId } = req.body;
    if (!ticketNumber || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Valid ticket number and event ID are required' });
    }
    const registration = await Registration.findOne({ ticketNumber }).populate('event');
    if (!registration) {
      return res.status(404).json({ valid: false, message: 'Ticket not found' });
    }
    const event = registration.event;
    if (String(event._id) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }
    if (!isStaffForEvent(req.user, event)) {
      return res.status(403).json({ valid: false, message: 'Not authorized to validate tickets for this event' });
    }
    if (event.status !== 'published') {
      return res.status(400).json({ valid: false, message: 'Event is not published' });
    }
    const eventDate = new Date(event.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      return res.status(400).json({ valid: false, message: 'Event has already finished' });
    }
    if (registration.status !== 'confirmed') {
      return res.status(400).json({ valid: false, message: 'Ticket is not active' });
    }
    res.json({
      valid: true,
      ticketNumber: registration.ticketNumber,
      status: registration.status,
      checkedIn: registration.checkedIn,
      event: { id: event._id, title: event.title },
      user: { id: registration.user._id, name: registration.user.name },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/check-in — check in a valid attendee (organizer/admin)
exports.checkInTicket = async (req, res, next) => {
  try {
    const { ticketNumber, eventId } = req.body;
    if (!ticketNumber || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Valid ticket number and event ID are required' });
    }
    const registration = await Registration.findOne({ ticketNumber }).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const event = registration.event;
    if (String(event._id) !== String(eventId)) {
      return res.status(400).json({ message: 'Ticket is for a different event' });
    }
    if (!isStaffForEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to check in attendees for this event' });
    }
    if (registration.status !== 'confirmed') {
      return res.status(400).json({ message: 'Ticket is not active' });
    }
    if (registration.checkedIn) {
      return res.status(400).json({ message: 'Attendee already checked in' });
    }
    // Atomic update prevents duplicate check-ins under concurrency.
    const updated = await Registration.findOneAndUpdate(
      { ticketNumber, status: 'confirmed', checkedIn: false },
      {
        $set: { checkedIn: true, checkedInAt: new Date(), checkedInBy: req.user.userId },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'Attendee already checked in or ticket is not active' });
    }
    res.json({
      message: 'Attendee checked in successfully',
      ticketNumber: updated.ticketNumber,
      checkedInAt: updated.checkedInAt,
    });
  } catch (err) {
    next(err);
  }
};
