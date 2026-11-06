const { isValidUuid } = require('../config/supabase');

function requireEventOwnershipOrAdmin() {
  return async (req, res, next) => {
    try {
      const eventId = req.params.id || req.params.eventId || req.body.eventId || req.body.event;
      if (!eventId) {
        return res.status(400).json({ message: 'Event ID required' });
      }
      if (!isValidUuid(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }
      const Event = require('../models/Event');
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      const userId = req.user && (req.user.userId || req.user._id);
      const isOwner = userId && String(event.organizer) === String(userId);
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to manage this event' });
      }
      req.event = event;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireRegistrationOwnershipOrAdmin() {
  return async (req, res, next) => {
    try {
      const regId = req.params.id || req.params.registrationId;
      if (!regId) {
        return res.status(400).json({ message: 'Registration ID required' });
      }
      if (!isValidUuid(regId)) {
        return res.status(400).json({ message: 'Invalid registration ID' });
      }
      const Registration = require('../models/Registration');
      const registration = await Registration.findById(regId);
      if (!registration) {
        return res.status(404).json({ message: 'Registration not found' });
      }
      const userId = req.user && (req.user.userId || req.user._id);
      const isOwner = userId && String(registration.user) === String(userId);
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      req.registration = registration;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireEventOwnershipOrAdmin,
  requireRegistrationOwnershipOrAdmin,
};
