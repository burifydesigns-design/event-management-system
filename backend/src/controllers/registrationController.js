const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const generateTicketNumber = require('../utils/ticketGenerator');
const { sendRegistrationConfirmation } = require('../services/emailService');
const { generateRegistrationQR } = require('../services/qrService');

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

    const userId = req.user.userId || req.user._id;
    const existingRegistration = await Registration.findOne({
      user: userId,
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
        
        // Send confirmation email for reactivated registration
        let emailStatus = 'not_sent';
        if (updated.user?.email) {
          const emailResult = await sendRegistrationConfirmation({ registrationId: updated._id });
          emailStatus = emailResult.status;
        }

        return res.status(201).json({
          message: 'Successfully registered for the event.',
          registration: updated,
          email: { status: emailStatus },
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
      user: userId,
      event: eventId,
      ticketNumber,
    });

    const populated = await Registration.findById(registration._id)
      .populate('user', 'name email')
      .populate('event');

    // Send confirmation email
    let emailStatus = 'not_sent';
    if (populated.user?.email) {
      const emailResult = await sendRegistrationConfirmation({ registrationId: populated._id });
      emailStatus = emailResult.status;
    }

    res.status(201).json({
      message: 'Successfully registered for the event.',
      registration: populated,
      email: { status: emailStatus },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyRegistrations = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    const registrations = await Registration.find({ user: userId, status: 'confirmed' })
      .populate('event')
      .sort({ registeredAt: -1 });
    res.json({ count: registrations.length, registrations });
  } catch (err) {
    next(err);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    const registrations = await Registration.find({ user: userId })
      .populate('event', 'title description category date time location city image status')
      .sort({ registeredAt: -1 });

    const now = new Date();
    const upcoming = [];
    const past = [];

    for (const reg of registrations) {
      if (reg.event) {
        const eventDate = new Date(reg.event.date);
        const eventTime = reg.event.time || '00:00';
        const [hours, minutes] = eventTime.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
        
        if (eventDate > now && reg.status === 'confirmed') {
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

    const userId = req.user.userId || req.user._id;
    if (String(registration.user) !== String(userId) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const event = await Event.findById(registration.event);
    if (event && new Date(event.date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Cannot cancel registration for past event' });
    }

    if (String(registration.user) === String(userId)) {
      registration.status = 'cancelled';
      registration.checkedIn = false;
      registration.checkedInAt = null;
      await registration.save();
    } else {
      await registration.deleteOne();
    }
    res.json({ message: 'Registration cancelled successfully.' });
  } catch (err) {
    next(err);
  }
};


exports.getRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id).populate('event').populate('user', 'name email');
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    const userId = req.user.userId || req.user._id;
    if (String(registration.user._id) !== String(userId) && String(registration.user) !== String(userId) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(registration);
  } catch (err) {
    next(err);
  }
};

exports.getTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.registrationId)) {
      return res.status(400).json({ message: 'Invalid registration ID' });
    }
    const registration = await Registration.findById(req.params.registrationId)
      .populate('event', 'title description category date time location city image status')
      .populate('user', 'name email');
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    
    const userId = req.user.userId || req.user._id;
    if (String(registration.user._id) !== String(userId) && String(registration.user) !== String(userId) && !['admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const qrCode = await generateRegistrationQR(registration.ticketNumber);

    const ticket = {
      ticketNumber: registration.ticketNumber,
      status: registration.status,
      registeredAt: registration.registeredAt,
      qrCode,
      attendee: {
        name: registration.user?.name,
        email: registration.user?.email,
      },
      event: registration.event ? {
        title: registration.event.title,
        description: registration.event.description,
        category: registration.event.category,
        date: registration.event.date,
        time: registration.event.time,
        location: registration.event.location,
        city: registration.event.city,
        image: registration.event.image,
      } : null,
    };

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};