const TicketInstance = require('../models/TicketInstance');

// Organizer/admin: purchases per event
exports.salesForEvent = async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    const total = await TicketInstance.countDocuments({ event: eventId });
    const used = await TicketInstance.countDocuments({ event: eventId, status: 'used' });
    res.json({ eventId, ticketsSold: total, ticketsScanned: used });
  } catch (err) {
    next(err);
  }
};
