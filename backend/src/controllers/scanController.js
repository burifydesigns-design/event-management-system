const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { parseRegistrationQRPayload } = require('../services/qrService');
const { canManageEvent } = require('../utils/eventPermissions');

exports.scanTicket = async (req, res, next) => {
  try {
    const { qrCode, eventId } = req.body || {};
    const staffUserId = req.user?.userId || req.user?._id;

    if (!qrCode || typeof qrCode !== 'string') {
      return res.status(400).json({ valid: false, message: 'QR code is required' });
    }
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ valid: false, message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ valid: false, message: 'Event not found' });
    }
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ valid: false, message: 'Unauthorized staff member' });
    }
    if (event.status === 'cancelled') {
      return res.status(400).json({ valid: false, message: 'Event has been cancelled' });
    }

    const decodedTicketNumber = parseRegistrationQRPayload(qrCode);
    if (!decodedTicketNumber) {
      return res.status(400).json({ valid: false, message: 'Invalid QR code' });
    }

    const registration = await Registration.findOne({ ticketNumber: decodedTicketNumber }).populate('event').populate('user', 'name email');
    if (!registration) {
      return res.status(404).json({ valid: false, message: 'Registration not found' });
    }

    if (String(registration.event?._id || registration.event) !== String(eventId)) {
      return res.status(400).json({ valid: false, message: 'Ticket belongs to a different event' });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({ valid: false, message: 'Registration cancelled or ineligible' });
    }

    if (registration.status === 'checked-in' || registration.checkedIn) {
      return res.status(409).json({ valid: false, message: 'Already checked in' });
    }

    const now = new Date();
    const eventStart = new Date(event.date);
    const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
    eventStart.setHours(hours || 0, minutes || 0, 0, 0);

    if (now < eventStart) {
      return res.status(400).json({ valid: false, message: 'Event not yet eligible for check-in' });
    }

    registration.status = 'checked-in';
    registration.checkedIn = true;
    registration.checkedInAt = now;
    registration.checkedInBy = staffUserId;
    await registration.save();

    const attendeeName = registration.user ? registration.user.name : null;
    const attendeeEmail = registration.user ? registration.user.email : null;

    return res.json({
      valid: true,
      message: 'Check-in successful',
      attendeeName,
      attendeeEmail,
      ticketNumber: registration.ticketNumber,
      status: registration.status,
      registration: {
        id: registration._id,
        ticketNumber: registration.ticketNumber,
        checkedIn: registration.checkedIn,
        checkedInAt: registration.checkedInAt,
      },
    });
  } catch (err) {
    next(err);
  }
};
