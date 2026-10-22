const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

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

// Admin event management list: all statuses (draft + published), paginated.
// `registeredCount` is resolved with a single $lookup aggregation, avoiding N+1.
exports.getAllEvents = async (req, res, next) => {
  try {
    const { page, limit, skip, error } = parsePagination(req.query, { defaultLimit: 10 });
    if (error) return res.status(400).json({ message: error });

    const { status, search } = req.query;
    const match = {};
    if (status) {
      if (!['draft', 'published'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      match.status = status;
    }
    if (search) {
      match.$or = [
        { title: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ];
    }

    const [result] = await Event.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'registrations',
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$event', '$$eventId'] },
                status: 'confirmed',
              },
            },
            { $count: 'count' },
          ],
          as: 'registrationCounts',
        },
      },
      {
        $addFields: {
          registeredCount: {
            $ifNull: [{ $arrayElemAt: ['$registrationCounts.count', 0] }, 0],
          },
        },
      },
      { $project: { registrationCounts: 0 } },
      // Deterministic sort with unique tie-breaker for stable pagination.
      { $sort: { date: 1, _id: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalItems' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const totalItems = (result && result.metadata && result.metadata[0] && result.metadata[0].totalItems) || 0;
    const data = (result && result.data) || [];

    res.json({ data, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};

exports.getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const { page, limit, skip, error } = parsePagination(req.query, { defaultLimit: 10 });
    if (error) return res.status(400).json({ message: error });

    const query = { event: eventId };
    const totalItems = await Registration.countDocuments(query);
    const attendees = await Registration.find(query)
      .populate('user', 'name email')
      .sort({ registeredAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ data: attendees, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};

exports.exportEventAttendees = async (req, res, next) => {
  try {
    // Step 23 contract: the export always includes ALL registrations matching
    // the authorized scope (the event), not just a paginated page.
    const registrations = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email')
      .populate('event', 'title')
      .sort({ registeredAt: -1, _id: -1 });

    let csv = 'Name,Email,Event,Ticket Number,Registration Date,Registration Status,Check-in Status\n';
    registrations.forEach((r) => {
      const name = r.user ? r.user.name.replace(/"/g, '""') : '';
      const email = r.user ? r.user.email : '';
      const eventTitle = r.event && r.event.title ? r.event.title.replace(/"/g, '""') : '';
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

// Additional analytics endpoint
exports.getAnalyticsDashboard = exports.getAnalytics;


// Add organizer-scoped analytics
exports.getOrganizerAnalytics = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const userId = req.user && (req.user.userId || req.user._id);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    const organizerObjectId = new mongoose.Types.ObjectId(String(userId));

    const events = await Event.find({ organizer: organizerObjectId }, '_id title capacity date');
    const eventIds = events.map(e => e._id);

    if (eventIds.length === 0) {
      return res.json({
        registrationsOverTime: [],
        registrationsPerEvent: [],
        checkInRate: 0,
        capacityUtilization: [],
      });
    }

    const registrationsOverTime = await Registration.aggregate([
      { $match: { event: { $in: eventIds } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const registrationsPerEvent = await Registration.aggregate([
      { $match: { event: { $in: eventIds }, status: 'confirmed' } },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalConfirmed = await Registration.countDocuments({ event: { $in: eventIds }, status: 'confirmed' });
    const totalCheckedIn = await Registration.countDocuments({ event: { $in: eventIds }, checkedIn: true });
    const checkInRate = totalConfirmed > 0 ? (totalCheckedIn / totalConfirmed) * 100 : 0;

    const capacityUtilization = await Event.aggregate([
      { $match: { _id: { $in: eventIds } } },
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

// GET /api/admin/users/:id
exports.getUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const { role } = req.body;
    if (!['attendee', 'organizer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) === String(req.user.userId) && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot change your own admin role' });
    }
    if (user.role === 'admin' && role !== 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: 'Cannot demote the last active administrator' });
      }
    }
    user.role = role;
    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/status
exports.updateUserStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) === String(req.user.userId) && status === 'suspended') {
      return res.status(400).json({ message: 'Cannot suspend your own account' });
    }
    if (user.role === 'admin' && status === 'suspended') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: 'Cannot suspend the last active administrator' });
      }
    }
    user.status = status;
    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (String(req.params.id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin' && user.status === 'active') {
      const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last active administrator' });
      }
    }
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/events/:id — admin deletes any event and its registrations
exports.deleteEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await Registration.deleteMany({ event: req.params.id });
    await event.deleteOne();
    res.json({ message: 'Event and its registrations deleted' });
  } catch (err) {
    next(err);
  }
};
