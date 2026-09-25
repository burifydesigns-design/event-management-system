const TicketInstance = require('../models/TicketInstance');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const mongoose = require('mongoose');

exports.scanTicket = async (req, res, next) => {
  try {
    const { qrToken, eventId } = req.body;

    if (!qrToken || !eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ valid: false, message: 'QR token and valid event ID are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ valid: false, message: 'Event not found' });
    if (event.status === 'cancelled') {
      return res.status(400).json({ valid: false, message: 'Event has been cancelled' });
    }

    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ valid: false, message: 'Not authorized for this event' });
    }

    let registration = null;
    let ticket = null;

    try {
      const parsed = JSON.parse(qrToken);
      if (parsed.registrationId && parsed.ticketNumber) {
        registration = await Registration.findOne({
          _id: parsed.registrationId,
          ticketNumber: parsed.ticketNumber,
          event: eventId,
        }).populate('user', 'name email');
      }
    } catch {
      registration = await Registration.findOne({
        ticketNumber: qrToken,
        event: eventId,
      }).populate('user', 'name email');
    }

    if (registration) {
      if (registration.status === 'cancelled') {
        return res.status(400).json({ valid: false, message: 'Ticket is void' });
      }
      if (registration.checkedIn) {
        return res.status(400).json({ valid: false, message: 'Ticket already checked in', checkedInAt: registration.checkedInAt });
      }

      registration.checkedIn = true;
      registration.checkedInAt = new Date();
      await registration.save();

      return res.json({
        valid: true,
        message: 'Check-in successful',
        attendeeName: registration.user?.name || 'N/A',
        attendeeEmail: registration.user?.email || 'N/A',
        ticketNumber: registration.ticketNumber,
        checkedInAt: registration.checkedInAt,
        eventTitle: event.title,
      });
    }

    ticket = await TicketInstance.findOne({ qrToken }).populate('attendee', 'name email');
    if (!ticket) {
      return res.status(404).json({ valid: false, message: 'Ticket not found' });
    }

    if (String(ticket.event) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket is for a different event' });
    }
    if (ticket.status === 'void') {
      return res.status(400).json({ valid: false, message: 'Ticket is void' });
    }
    if (ticket.status === 'used') {
      return res.status(400).json({ valid: false, message: 'Ticket already checked in', checkedInAt: ticket.scannedAt });
    }

    const reg = await Registration.findOne({
      user: ticket.attendee._id,
      event: event._id,
      status: 'confirmed',
    });

    if (!reg) {
      return res.status(400).json({ valid: false, message: 'Registration not found or cancelled' });
    }

    const updated = await TicketInstance.findOneAndUpdate(
      { _id: ticket._id, status: 'valid' },
      { status: 'used', scannedAt: new Date(), scannedBy: req.user.userId },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ valid: false, message: 'Ticket already checked in' });
    }

    reg.checkedIn = true;
    reg.checkedInAt = new Date();
    await reg.save();

    res.json({
      valid: true,
      message: 'Check-in successful',
      attendeeName: ticket.attendee.name,
      attendeeEmail: ticket.attendee.email,
      ticketNumber: reg.ticketNumber,
      checkedInAt: updated.scannedAt,
      eventTitle: event.title,
    });
  } catch (err) {
    next(err);
  }
};
