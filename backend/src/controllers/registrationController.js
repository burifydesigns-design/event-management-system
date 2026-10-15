const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { generateTicketToken } = require('../services/qrService');
const { sendRegistrationEmail } = require('../services/emailService');

function generateTicketNumber() {
  return `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') return res.status(400).json({ message: 'Event is not published' });
    if (new Date(event.date) < new Date(new Date().toDateString())) return res.status(400).json({ message: 'Event is in the past' });

    const currentRegistrations = await Registration.countDocuments({ event: eventId, status: 'confirmed' });
    if (currentRegistrations >= event.capacity) return res.status(409).json({ message: 'Event is full' });

    const existingRegistration = await Registration.findOne({ user: req.user._id, event: eventId });
    if (existingRegistration) return res.status(409).json({ message: 'Already registered for this event' });

    const ticketNumber = generateTicketNumber();
    const registration = await Registration.create({
      user: req.user._id,
      event: eventId,
      ticketNumber,
    });

    await event.populate('organizer', 'name email');
    const eventDetails = {
      name: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      city: event.city,
    };

    sendRegistrationEmail(req.user.email, eventDetails, ticketNumber).catch(() => {});

    res.status(201).json({
      ...registration.toObject(),
      event: {
        id: event._id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        city: event.city,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user._id, status: 'confirmed' })
      .populate('event')
      .sort({ registeredAt: -1 });
    res.json(registrations);
  } catch (err) {
    next(err);
  }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    if (String(registration.user) !== String(req.user._id) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const event = await Event.findById(registration.event);
    if (event && new Date(event.date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Cannot cancel registration for past event' });
    }
    if (String(registration.user) === String(req.user._id)) {
      registration.status = 'cancelled';
      await registration.save();
    } else {
      await registration.deleteOne();
    }
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    next(err);
  }
};
