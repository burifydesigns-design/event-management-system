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
    const registrationsOverTime = await Registration.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const registrationsPerEvent = await Registration.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalConfirmed = await Registration.countDocuments({ status: 'confirmed' });
    const totalCheckedIn = await Registration.countDocuments({ checkedIn: true });
    const checkInRate = totalConfirmed > 0 ? (totalCheckedIn / totalConfirmed) * 100 : 0;

    const capacityUtilization = await Event.aggregate([
      {
        $lookup: {
          from: 'registrations',
          localField: '_id',
          foreignField: 'event',
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
    ]);

    res.json({
      registrationsOverTime,
      registrationsPerEvent,
      checkInRate,
      capacityUtilization,
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
