const TicketType = require('../models/TicketType');

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
