const TicketInstance = require('../models/TicketInstance');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;

    if (!qrToken || !eventId) {
      return res.status(400).json({ valid: false, message: 'QR token and event ID are required' });
    }

    const ticketQuery = await TicketInstance.findOne({ qrToken });
    if (!ticketQuery) {
      return res.status(404).json({ valid: false, message: 'Ticket not found' });
    }

    const ticket = await ticketQuery
      .populate('event', 'title status organizer')
      .populate('attendee', 'name email');

    if (String(ticket.event._id) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }

    if (ticket.status === 'void') {
      return res.status(400).json({ valid: false, message: 'Ticket is void' });
    }

    if (ticket.status === 'used') {
      return res.status(400).json({ valid: false, message: 'Ticket already checked in', checkedInAt: ticket.scannedAt });
    }

    const event = ticket.event;
    if (event.status === 'cancelled') {
      return res.status(400).json({ valid: false, message: 'Event has been cancelled' });
    }

    const registration = await Registration.findOne({
      user: ticket.attendee._id,
      event: event._id,
      status: 'confirmed',
    });

    if (!registration) {
      return res.status(400).json({ valid: false, message: 'Registration not found or cancelled' });
    }

    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ valid: false, message: 'Not authorized for this event' });
    }

    const updated = await TicketInstance.findOneAndUpdate(
      { _id: ticket._id, status: 'valid' },
      { status: 'used', scannedAt: new Date(), scannedBy: req.user.userId },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ valid: false, message: 'Ticket already checked in' });
    }

    res.status(200).json({
      valid: true,
      message: 'Check-in successful',
      attendeeName: ticket.attendee.name,
      attendeeEmail: ticket.attendee.email,
      ticketNumber: registration.ticketNumber,
      checkedInAt: updated.scannedAt,
    });
  } catch (err) {
    next(err);
  }
};
