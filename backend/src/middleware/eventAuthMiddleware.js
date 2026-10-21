const Event = require('../models/Event');
const mongoose = require('mongoose');

function requireEventAccess() {
  return async (req, res, next) => {
    try {
      const eventId = req.params.eventId || req.params.id;
      if (!eventId) {
        return res.status(400).json({ message: 'Event ID required' });
      }
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      const userId = req.user && (req.user.userId || req.user._id);
      const isOwner = userId && String(event.organizer) === String(userId);
      const isAdmin = req.user && req.user.role === 'admin';
      const isOrganizerRole = req.user && (req.user.role === 'organizer' || req.user.role === 'coordinator');
      if (!(isOwner || isAdmin || isOrganizerRole)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      req.event = event;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireEventAccess };
