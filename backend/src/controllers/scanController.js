const TicketInstance = require('../models/TicketInstance');

// Coordinator or organizer scans a QR code at the door
exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;
    const ticket = await TicketInstance.findOne({ qrToken });

    if (!ticket) return res.status(404).json({ valid: false, message: 'Ticket not found' });
    if (String(ticket.event) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }
    if (ticket.status === 'used') {
      return res.status(400).json({ valid: false, message: 'Ticket already used' });
    }
    if (ticket.status === 'void') {
      return res.status(400).json({ valid: false, message: 'Ticket is void' });
    }

    ticket.status = 'used';
    ticket.scannedAt = new Date();
    ticket.scannedBy = req.user._id;
    await ticket.save();

    res.json({ valid: true, message: 'Ticket valid — attendee admitted' });
  } catch (err) {
    next(err);
  }
};
