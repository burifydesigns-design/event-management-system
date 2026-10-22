const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');

function isEventStaff(user, event) {
  if (!user || !event) return false;
  return user.role === 'admin' || String(event.organizer) === String(user.userId || user._id);
}

// GET /api/analytics/overview — platform-wide metrics (admin only)
exports.getOverview = async (req, res, next) => {
  try {
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const now = new Date();
    const upcomingEvents = await Event.countDocuments({ status: 'published', date: { $gte: now } });

    const totalRegistrations = await Registration.countDocuments();
    const confirmedRegistrations = await Registration.countDocuments({ status: 'confirmed' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
    const checkedInRegistrations = await Registration.countDocuments({ checkedIn: true });

    const attendanceRate =
      confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;

    const registrationTrends = await Registration.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalEvents,
      publishedEvents,
      upcomingEvents,
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      checkedInRegistrations,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      registrationTrends,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/events/:id — event-specific stats (organizer of the event or admin)
exports.getEventAnalytics = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventStaff(req.user, event)) {
      return res.status(403).json({ message: 'Not authorized to view analytics for this event' });
    }

    const totalRegistrations = await Registration.countDocuments({ event: req.params.id });
    const confirmedRegistrations = await Registration.countDocuments({
      event: req.params.id,
      status: 'confirmed',
    });
    const cancelledRegistrations = await Registration.countDocuments({
      event: req.params.id,
      status: 'cancelled',
    });
    const checkedInRegistrations = await Registration.countDocuments({
      event: req.params.id,
      checkedIn: true,
    });

    const attendanceRate =
      confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;
    const capacityUtilization =
      event.capacity > 0 ? (confirmedRegistrations / event.capacity) * 100 : 0;

    const registrationTrends = await Registration.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      event: {
        id: event._id,
        title: event.title,
        status: event.status,
        date: event.date,
        capacity: event.capacity,
      },
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      checkedInRegistrations,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      capacityUtilization: Math.round(capacityUtilization * 100) / 100,
      registrationTrends,
    });
  } catch (err) {
    next(err);
  }
};
