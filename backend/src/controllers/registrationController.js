const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const generateTicketNumber = require('../utils/ticketGenerator');
const { sendRegistrationConfirmationEmail } = require('../services/emailService');

function getBaseUrl(req) {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
}

exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') return res.status(400).json({ message: 'Event is not published' });
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({ message: 'Event is in the past' });
    }

    const existingRegistration = await Registration.findOne({
      user: req.user.userId,
      event: eventId,
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'confirmed') {
        return res.status(409).json({ message: 'You are already registered for this event.' });
      }
      if (existingRegistration.status === 'cancelled') {
        existingRegistration.status = 'confirmed';
        existingRegistration.ticketNumber = generateTicketNumber();
        existingRegistration.registeredAt = new Date();
        existingRegistration.checkedIn = false;
        existingRegistration.checkedInAt = null;
        await existingRegistration.save();

        const updated = await Registration.findById(existingRegistration._id)
          .populate('user', 'name email')
          .populate('event');

        const baseUrl = getBaseUrl(req);
        const user = await User.findById(req.user.userId).select('name email');
        const emailResult = await sendRegistrationConfirmationEmail(user, event, updated, baseUrl);

        return res.status(201).json({
          message: 'Successfully registered for the event.',
          registration: updated,
          emailSent: emailResult.success,
        });
      }
    }

    const activeRegistrations = await Registration.countDocuments({
      event: eventId,
      status: 'confirmed',
    });
    if (activeRegistrations >= event.capacity) {
      return res.status(400).json({ message: 'This event is full.' });
    }

    const ticketNumber = generateTicketNumber();
    const registration = await Registration.create({
      user: req.user.userId,
      event: eventId,
      ticketNumber,
    });

    const populated = await Registration.findById(registration._id)
      .populate('user', 'name email')
      .populate('event');

    const baseUrl = getBaseUrl(req);
    const user = await User.findById(req.user.userId).select('name email');
    const emailResult = await sendRegistrationConfirmationEmail(user, event, populated, baseUrl);

    res.status(201).json({
      message: 'Successfully registered for the event.',
      registration: populated,
      emailSent: emailResult.success,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user.userId, status: 'confirmed' })
      .populate('event')
      .sort({ registeredAt: -1 });
    res.json({ count: registrations.length, registrations });
  } catch (err) {
    next(err);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user.userId })
      .populate('event', 'title description category date time location city image status')
      .sort({ registeredAt: -1 });

    const now = new Date();
    const upcoming = [];
    const past = [];

    for (const reg of registrations) {
      if (reg.event) {
        const eventDateTime = new Date(`${reg.event.date}T${reg.event.time || '00:00'}`);
        if (eventDateTime > now && reg.status === 'confirmed') {
          upcoming.push(reg);
        } else {
          past.push(reg);
        }
      } else {
        past.push(reg);
      }
    }

    res.json({
      upcoming,
      past,
      count: {
        upcoming: upcoming.length,
        past: past.length,
        total: registrations.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    if (String(registration.user) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const event = await Event.findById(registration.event);
    if (event && new Date(event.date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Cannot cancel registration for past event' });
    }

    registration.status = 'cancelled';
    registration.checkedIn = false;
    registration.checkedInAt = null;
    await registration.save();

    res.json({ message: 'Registration cancelled successfully.' });
  } catch (err) {
    next(err);
  }
};