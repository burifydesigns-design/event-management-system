const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { canManageEvent } = require('../utils/eventPermissions');

// Organizer creates a ticket type for one of their events
exports.createTicketType = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Ticket details are required' });
    }
    const { event: eventId, name, price, quantityAvailable } = req.body;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Valid event ID is required' });
    }
    if (typeof name !== 'string' || !name.trim()
      || !Number.isFinite(Number(price)) || Number(price) < 0
      || !Number.isInteger(Number(quantityAvailable)) || Number(quantityAvailable) < 1) {
      return res.status(400).json({ message: 'Ticket name, non-negative price, and positive quantity are required' });
    }

    const event = await Event.findById(eventId).select('organizer');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to manage tickets for this event' });
    }

    const ticketType = await TicketType.create({
      event: event._id,
      name: name.trim(),
      price: Number(price),
      quantityAvailable: Number(quantityAvailable),
    });
    res.status(201).json(ticketType);
  } catch (err) {
    next(err);
  }
};

exports.listTicketTypesForEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const ticketTypes = await TicketType.find({ event: req.params.eventId });
    res.json(ticketTypes);
  } catch (err) {
    next(err);
  }
};
