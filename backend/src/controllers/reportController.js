const TicketInstance = require('../models/TicketInstance');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { canManageEvent } = require('../utils/eventPermissions');

// Organizer/admin: purchases per event
exports.salesForEvent = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(eventId).select('organizer');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to view this event report' });
    }

    const total = await TicketInstance.countDocuments({ event: eventId });
    const used = await TicketInstance.countDocuments({ event: eventId, status: 'used' });
    res.json({ eventId, ticketsSold: total, ticketsScanned: used });
  } catch (err) {
    next(err);
  }
};
