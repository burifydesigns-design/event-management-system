const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');

const ACTIVE_REGISTRATION_STATUSES = ['confirmed', 'checked-in'];
const EVENT_STATUSES = ['draft', 'published', 'cancelled'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEventFilter(queryParams) {
  const { search, category, city, status, date } = queryParams;
  const filter = {};

  for (const [name, value] of Object.entries({ search, category, city, status, date })) {
    if (value !== undefined && (typeof value !== 'string' || value.length > 100)) {
      return { error: `Invalid ${name} filter` };
    }
  }
  if (status && status !== 'all' && !EVENT_STATUSES.includes(status)) {
    return { error: 'Invalid status filter' };
  }
  if (date && !['all', 'upcoming', 'past'].includes(date)) {
    return { error: 'Invalid date filter' };
  }

  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
  if (category) filter.category = category;
  if (city) filter.city = { $regex: escapeRegex(city), $options: 'i' };
  if (status && status !== 'all') filter.status = status;

  if (date && date !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filter.date = date === 'upcoming' ? { $gte: today } : { $lt: today };
    if (date === 'upcoming' && !filter.status) filter.status = 'published';
  }

  return { filter };
}

function parseDateRange(query) {
  const { startDate, endDate, range } = query;
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let start, end = now;

  if (range && !startDate && !endDate) {
    switch (range) {
      case '7d':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case '30d':
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case '90d':
        start = new Date(now);
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
        break;
      case 'all':
      default:
        start = new Date(0);
        break;
    }
  } else {
    if (startDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0);
    }
    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'Invalid date format' };
  }
  if (start > end) {
    return { error: 'Start date must be before end date' };
  }

  return { start, end };
}

function buildRegistrationDateFilter(start, end, field = 'registeredAt') {
  return { [field]: { $gte: start, $lte: end } };
}

exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalUsers,
      totalEvents,
      totalRegistrations,
      upcomingEvents,
      pastEvents,
      capacityResult,
    ] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Registration.countDocuments(),
      Event.countDocuments({ status: 'published', date: { $gte: today } }),
      Event.countDocuments({ status: { $ne: 'cancelled' }, date: { $lt: today } }),
      Event.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $lookup: {
            from: 'registrations',
            let: { eventId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$event', '$$eventId'] },
                      { $in: ['$status', ACTIVE_REGISTRATION_STATUSES] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  activeCount: {
                    $sum: { $cond: [{ $in: ['$status', ACTIVE_REGISTRATION_STATUSES] }, 1, 0] },
                  },
                  checkedInCount: {
                    $sum: {
                      $cond: [{ $or: [{ $eq: ['$checkedIn', true] }, { $eq: ['$status', 'checked-in'] }] }, 1, 0],
                    },
                  },
                },
              },
            ],
            as: 'registrationCounts',
          },
        },
        {
          $group: {
            _id: null,
            activeRegistrations: {
              $sum: { $ifNull: [{ $arrayElemAt: ['$registrationCounts.activeCount', 0] }, 0] },
            },
            checkedInAttendees: {
              $sum: { $ifNull: [{ $arrayElemAt: ['$registrationCounts.checkedInCount', 0] }, 0] },
            },
            availableSeats: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'published'] },
                      { $gte: ['$date', today] },
                    ],
                  },
                  {
                    $max: [
                      0,
                      {
                        $subtract: [
                          '$capacity',
                          { $ifNull: [{ $arrayElemAt: ['$registrationCounts.activeCount', 0] }, 0] },
                        ],
                      },
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      totalUsers,
      totalEvents,
      totalRegistrations,
      activeRegistrations: capacityResult[0]?.activeRegistrations || 0,
      upcomingEvents,
      pastEvents,
      availableSeats: capacityResult[0]?.availableSeats || 0,
      checkedInAttendees: capacityResult[0]?.checkedInAttendees || 0,
    });
  } catch (err) {
    next(err);
  }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const eventExists = await Event.exists({ _id: req.params.eventId });
    if (!eventExists) return res.status(404).json({ message: 'Event not found' });

    const attendees = await Registration.find({ event: req.params.eventId })
      .select('event user ticketNumber status registeredAt checkedIn checkedInAt')
      .populate('user', 'name email')
      .sort({ registeredAt: -1 })
      .lean();
    res.json(attendees);
  } catch (err) {
    next(err);
  }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.eventId).select('title').lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const registrations = await Registration.find({ event: req.params.eventId })
      .select('user ticketNumber registeredAt status checkedIn')
      .populate('user', 'name email');

    let csv = 'Name,Email,Event,Ticket Number,Registration Date,Registration Status,Check-in Status\n';
    registrations.forEach((r) => {
      const name = r.user ? r.user.name.replace(/"/g, '""') : '';
      const email = r.user ? r.user.email : '';
      const eventTitle = event.title.replace(/"/g, '""');
      const checkInStatus = r.checkedIn ? 'Checked In' : 'Not Checked In';
      csv += `"${name}","${email}","${eventTitle}","${r.ticketNumber}","${r.registeredAt}","${r.status}","${checkInStatus}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendees.csv`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (dateRange.error) return res.status(400).json({ message: dateRange.error });
    const { start, end } = dateRange;

    const registrationsOverTime = await Registration.aggregate([
      { $match: buildRegistrationDateFilter(start, end) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const registrationsPerEvent = await Registration.aggregate([
      { $match: { status: 'confirmed', registeredAt: { $gte: start, $lte: end } } },
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
      { $unwind: '$event' },
      {
        $project: {
          eventId: '$_id',
          eventName: '$event.title',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalConfirmed = await Registration.countDocuments({
      status: 'confirmed',
      registeredAt: { $gte: start, $lte: end },
    });
    const totalCheckedIn = await Registration.countDocuments({
      checkedIn: true,
      checkedInAt: { $gte: start, $lte: end },
    });
    const checkInRate = totalConfirmed > 0 ? Math.round((totalCheckedIn / totalConfirmed) * 100) : 0;

    const capacityUtilization = await Event.aggregate([
      {
        $lookup: {
          from: 'registrations',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$event', '$$eventId'] },
                    { $in: ['$status', ACTIVE_REGISTRATION_STATUSES] },
                  ],
                },
              },
            },
          ],
          as: 'registrations',
        },
      },
      {
        $project: {
          title: 1,
          capacity: 1,
          registered: { $size: '$registrations' },
          utilization: {
            $cond: [
              { $eq: ['$capacity', 0] },
              0,
              { $multiply: [{ $divide: [{ $size: '$registrations' }, '$capacity'] }, 100] },
            ],
          },
        },
      },
      { $sort: { utilization: -1 } },
    ]);

    const eventStatusCounts = await Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary = {
      totalEvents: await Event.countDocuments(),
      upcomingEvents: await Event.countDocuments({ status: 'published', date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      pastEvents: await Event.countDocuments({ status: { $ne: 'cancelled' }, date: { $lt: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      totalRegistrations: await Registration.countDocuments({ registeredAt: { $gte: start, $lte: end } }),
      activeRegistrations: await Registration.countDocuments({ status: { $in: ACTIVE_REGISTRATION_STATUSES }, registeredAt: { $gte: start, $lte: end } }),
      checkedInAttendees: totalCheckedIn,
      checkInRate,
      eventStatusCounts,
    };

    res.json({
      summary,
      registrationsOverTime,
      registrationsPerEvent,
      capacityUtilization,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOrganizerAnalytics = async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (dateRange.error) return res.status(400).json({ message: dateRange.error });
    const { start, end } = dateRange;

    const organizerId = req.user._id;

    const organizerEvents = await Event.find({ organizer: organizerId }).select('_id').lean();
    const organizerEventIds = organizerEvents.map(e => e._id);

    if (organizerEventIds.length === 0) {
      return res.json({
        summary: {
          totalEvents: 0,
          upcomingEvents: 0,
          pastEvents: 0,
          totalRegistrations: 0,
          activeRegistrations: 0,
          checkedInAttendees: 0,
          checkInRate: 0,
          eventStatusCounts: [],
        },
        registrationsOverTime: [],
        registrationsPerEvent: [],
        capacityUtilization: [],
        topEvents: [],
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      });
    }

    const registrationsOverTime = await Registration.aggregate([
      { $match: { event: { $in: organizerEventIds }, ...buildRegistrationDateFilter(start, end) } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const registrationsPerEvent = await Registration.aggregate([
      {
        $match: {
          event: { $in: organizerEventIds },
          status: 'confirmed',
          registeredAt: { $gte: start, $lte: end },
        },
      },
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
      { $unwind: '$event' },
      {
        $project: {
          eventId: '$_id',
          eventName: '$event.title',
          eventDate: '$event.date',
          eventStatus: '$event.status',
          capacity: '$event.capacity',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalConfirmed = await Registration.countDocuments({
      event: { $in: organizerEventIds },
      status: 'confirmed',
      registeredAt: { $gte: start, $lte: end },
    });
    const totalCheckedIn = await Registration.countDocuments({
      event: { $in: organizerEventIds },
      checkedIn: true,
      checkedInAt: { $gte: start, $lte: end },
    });
    const checkInRate = totalConfirmed > 0 ? Math.round((totalCheckedIn / totalConfirmed) * 100) : 0;

    const capacityUtilization = await Event.aggregate([
      { $match: { _id: { $in: organizerEventIds } } },
      {
        $lookup: {
          from: 'registrations',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$event', '$$eventId'] },
                    { $in: ['$status', ACTIVE_REGISTRATION_STATUSES] },
                  ],
                },
              },
            },
          ],
          as: 'registrations',
        },
      },
      {
        $project: {
          title: 1,
          capacity: 1,
          registered: { $size: '$registrations' },
          utilization: {
            $cond: [
              { $eq: ['$capacity', 0] },
              0,
              { $multiply: [{ $divide: [{ $size: '$registrations' }, '$capacity'] }, 100] },
            ],
          },
        },
      },
      { $sort: { utilization: -1 } },
    ]);

    const eventStatusCounts = await Event.aggregate([
      { $match: { _id: { $in: organizerEventIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEvents = await Event.countDocuments({
      _id: { $in: organizerEventIds },
      status: 'published',
      date: { $gte: today },
    });

    const pastEvents = await Event.countDocuments({
      _id: { $in: organizerEventIds },
      status: { $ne: 'cancelled' },
      date: { $lt: today },
    });

    const topEvents = registrationsPerEvent.slice(0, 5).map(e => ({
      eventId: e.eventId,
      eventName: e.eventName,
      eventDate: e.eventDate,
      eventStatus: e.eventStatus,
      registrations: e.count,
      capacity: e.capacity,
      occupancyRate: e.capacity > 0 ? Math.round((e.count / e.capacity) * 100) : 0,
    }));

    const summary = {
      totalEvents: organizerEventIds.length,
      upcomingEvents,
      pastEvents,
      totalRegistrations: await Registration.countDocuments({ event: { $in: organizerEventIds }, registeredAt: { $gte: start, $lte: end } }),
      activeRegistrations: await Registration.countDocuments({ event: { $in: organizerEventIds }, status: { $in: ACTIVE_REGISTRATION_STATUSES }, registeredAt: { $gte: start, $lte: end } }),
      checkedInAttendees: totalCheckedIn,
      checkInRate,
      eventStatusCounts,
    };

    res.json({
      summary,
      registrationsOverTime,
      registrationsPerEvent,
      capacityUtilization,
      topEvents,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (err) {
    next(err);
  }
};


exports.getAllEvents = async (req, res, next) => {
  try {
    const { filter, error } = buildEventFilter(req.query);
    if (error) return res.status(400).json({ message: error });

    const events = await Event.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'registrations',
          let: { eventId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$event', '$$eventId'] } } },
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
                activeCount: {
                  $sum: { $cond: [{ $in: ['$status', ACTIVE_REGISTRATION_STATUSES] }, 1, 0] },
                },
              },
            },
          ],
          as: 'registrationCounts',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, email: 1 } }],
          as: 'organizerDetails',
        },
      },
      {
        $addFields: {
          registeredCount: {
            $cond: [
              { $eq: ['$status', 'cancelled'] },
              0,
              { $ifNull: [{ $arrayElemAt: ['$registrationCounts.activeCount', 0] }, 0] },
            ],
          },
          hasRegistrations: {
            $gt: [{ $ifNull: [{ $arrayElemAt: ['$registrationCounts.totalCount', 0] }, 0] }, 0],
          },
          organizer: { $ifNull: [{ $arrayElemAt: ['$organizerDetails', 0] }, null] },
        },
      },
      { $project: { registrationCounts: 0, organizerDetails: 0 } },
      { $sort: { date: 1, title: 1 } },
    ]);
    res.json(events);
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['attendee', 'coordinator', 'organizer', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};
