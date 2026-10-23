const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { generateAttendeesCSV } = require('../utils/csvExport');

exports.getDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const totalRegistrations = await Registration.countDocuments();
    const upcomingEvents = await Event.countDocuments({ status: 'published', date: { $gte: new Date() } });

    const capacityResult = await Event.aggregate([
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity' },
        },
      },
    ]);
    const availableSeats = capacityResult.length > 0 ? capacityResult[0].totalCapacity : 0;

    const checkedInAttendees = await Registration.countDocuments({ checkedIn: true });

    res.json({
      totalUsers,
      totalEvents,
      totalRegistrations,
      upcomingEvents,
      availableSeats,
      checkedInAttendees,
    });
  } catch (err) {
    next(err);
  }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (req.user.role === 'organizer') {
      const event = await Event.findById(eventId).select('_id organizer');
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      if (String(event.organizer) !== String(req.user.userId)) {
        return res.status(403).json({ message: 'Not authorized to view this event' });
      }
    }

    const attendees = await Registration.find({ event: eventId })
      .populate('user', 'name email')
      .sort({ registeredAt: -1 });
    res.json(attendees);
  } catch (err) {
    next(err);
  }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId || !require('mongoose').Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Role-based scope: organizers may only export events they organize.
    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to export this event' });
    }

    const registrations = await Registration.find({ event: eventId })
      .populate('user', 'name email')
      .populate('event', 'title')
      .sort({ registeredAt: -1 });

    const csv = generateAttendeesCSV(registrations);

    const safeEventId = String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `attendees-${safeEventId}-${dateStamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

function dateRangeMatch(startDate, endDate) {
  const match = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) match.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      match.$lte = end;
    }
  }
  return Object.keys(match).length > 0 ? match : null;
}

exports.getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const rangeMatch = dateRangeMatch(startDate, endDate);

    const registrationMatch = {};
    if (rangeMatch) registrationMatch.registeredAt = rangeMatch;

    // Organizers see only their own events; admins see platform-wide data.
    let organizerEventIds = null;
    if (req.user.role === 'organizer') {
      organizerEventIds = await Event.find({ organizer: req.user.userId }).distinct('_id');
      if (organizerEventIds.length === 0) {
        return res.json({
          registrationsOverTime: [],
          registrationsPerEvent: [],
          checkInRate: 0,
          totalCheckedIn: 0,
          totalConfirmed: 0,
          capacityUtilization: [],
        });
      }
      registrationMatch.event = { $in: organizerEventIds };
    }

    // Registrations over time: grouped by registration timestamp (not event date).
    const registrationsOverTime = await Registration.aggregate([
      { $match: registrationMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Registrations per event: confirmed registrations only, with event name.
    const registrationsPerEvent = await Registration.aggregate([
      { $match: { ...registrationMatch, status: 'confirmed' } },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: '_id',
          as: 'event',
        },
      },
      {
        $project: {
          _id: 0,
          eventId: '$_id',
          eventName: { $arrayElemAt: ['$event.title', 0] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalConfirmed = await Registration.countDocuments({
      ...registrationMatch,
      status: 'confirmed',
    });
    const totalCheckedIn = await Registration.countDocuments({
      ...registrationMatch,
      status: 'confirmed',
      checkedIn: true,
    });
    const checkInRate = totalConfirmed > 0 ? (totalCheckedIn / totalConfirmed) * 100 : 0;

    // Capacity utilization: confirmed registrations only (cancelled excluded).
    const capacityUtilization = await Event.aggregate([
      organizerEventIds ? { $match: { _id: { $in: organizerEventIds } } } : { $match: {} },
      {
        $lookup: {
          from: 'registrations',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$event', '$$eventId'] },
                status: 'confirmed',
                ...(rangeMatch ? { registeredAt: rangeMatch } : {}),
              },
            },
            { $count: 'count' },
          ],
          as: 'regCount',
        },
      },
      {
        $project: {
          _id: 0,
          eventId: '$_id',
          eventName: '$title',
          capacity: 1,
          registered: {
            $ifNull: [{ $arrayElemAt: ['$regCount.count', 0] }, 0],
          },
          utilization: {
            $cond: [
              { $eq: ['$capacity', 0] },
              0,
              {
                $multiply: [
                  { $divide: [{ $ifNull: [{ $arrayElemAt: ['$regCount.count', 0] }, 0] }, '$capacity'] },
                  100,
                ],
              },
            ],
          },
        },
      },
      { $sort: { utilization: -1 } },
    ]);

    res.json({
      registrationsOverTime,
      registrationsPerEvent,
      checkInRate,
      totalCheckedIn,
      totalConfirmed,
      capacityUtilization,
    });
  } catch (err) {
    next(err);
  }
};
