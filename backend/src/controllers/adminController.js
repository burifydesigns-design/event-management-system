const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

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
    const attendees = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email')
      .sort({ registeredAt: -1 });
    res.json(attendees);
  } catch (err) {
    next(err);
  }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email');

    let csv = 'Name,Email,Event,Ticket Number,Registration Date,Registration Status,Check-in Status\n';
    registrations.forEach((r) => {
      const name = r.user ? r.user.name.replace(/"/g, '""') : '';
      const email = r.user ? r.user.email : '';
      const eventTitle = r.event ? r.event.title.replace(/"/g, '""') : '';
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
