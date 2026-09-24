const TicketType = require('../models/TicketType');
const TicketInstance = require('../models/TicketInstance');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

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

exports.getTicket = async (req, res, next) => {
  try {
    const rawTicket = await TicketInstance.findById(req.params.ticketId);
    if (!rawTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const ticket = await TicketInstance.findById(req.params.ticketId)
      .populate('event', 'title date time location city status organizer')
      .populate('attendee', 'name email');

    const isOwner = String(ticket.attendee._id) === String(req.user.userId);
    const isAdmin = req.user.role === 'admin';
    const isOrganizer = req.user.role === 'organizer' && String(ticket.event.organizer) === String(req.user.userId);

    if (!isOwner && !isAdmin && !isOrganizer) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const registration = await Registration.findOne({
      user: ticket.attendee._id,
      event: ticket.event._id,
    });

    res.status(200).json({
      ticket: {
        _id: ticket._id,
        qrToken: ticket.qrToken,
        status: ticket.status,
        scannedAt: ticket.scannedAt,
        event: ticket.event,
        attendee: ticket.attendee,
      },
      registration: registration || { ticketNumber: null, status: null },
    });
  } catch (err) {
    next(err);
  }
};
