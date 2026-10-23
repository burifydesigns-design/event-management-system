const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Order = require('../models/Order');
const TicketInstance = require('../models/TicketInstance');
const CheckInLog = require('../models/CheckInLog');
const CoordinatorAssignment = require('../models/CoordinatorAssignment');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const DEFAULT_RANGE_DAYS = 90;
const MAX_RANGE_DAYS = 365;

function parseDateRange(req) {
  let { start, end } = req.query;
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(now.getDate() - DEFAULT_RANGE_DAYS);

  let startDate, endDate;
  if (start) {
    startDate = new Date(start);
    if (isNaN(startDate.getTime())) startDate = defaultStart;
  } else {
    startDate = defaultStart;
  }
  if (end) {
    endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    if (isNaN(endDate.getTime())) endDate = now;
  } else {
    endDate = now;
  }

  const rangeLimit = new Date(now);
  rangeLimit.setDate(now.getDate() - MAX_RANGE_DAYS);
  if (startDate < rangeLimit) startDate = rangeLimit;
  if (endDate > now) endDate = now;
  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  return { startDate, endDate };
}

async function isEventStaff(user, event) {
  if (!user || !event) return false;
  if (user.role === 'admin') return true;
  if (String(event.organizer) === String(user.userId || user._id)) return true;
  if (user.role === 'coordinator') {
    const assignment = await CoordinatorAssignment.findOne({
      coordinator: user.userId || user._id,
      event: event._id,
    });
    return !!assignment;
  }
  return false;
}

/**
 * GET /api/analytics/overview — Platform-wide metrics (admin only).
 */
exports.getOverview = async (req, res, next) => {
  try {
    const totalUsers = await mongoose.model('User').countDocuments();
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const upcomingEvents = await Event.countDocuments({ status: 'published', date: { $gte: new Date() } });

    const totalRegistrations = await Registration.countDocuments();
    const confirmedRegistrations = await Registration.countDocuments({ status: 'confirmed' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
    const checkedInRegistrations = await Registration.countDocuments({ checkedIn: true });

    const attendanceRate = confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;

    const revenueResult = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, gross: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const grossRevenue = revenueResult.length > 0 ? revenueResult[0].gross : 0;
    const paidOrders = revenueResult.length > 0 ? revenueResult[0].count : 0;

    const registrationTrends = await Registration.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const checkInTrends = await CheckInLog.aggregate([
      { $match: { result: 'valid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalUsers,
      totalEvents,
      publishedEvents,
      upcomingEvents,
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      checkedInRegistrations,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      grossRevenue,
      paidOrders,
      registrationTrends,
      checkInTrends,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/events/:id — Event-specific stats (organizer/admin/coordinator).
 */
exports.getEventAnalytics = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const authorized = await isEventStaff(req.user, event);
    if (!authorized) {
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

    const attendanceRate = confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;
    const capacityUtilization = event.capacity > 0 ? (confirmedRegistrations / event.capacity) * 100 : 0;

    const revenueResult = await Order.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(req.params.id), status: 'paid' } },
      { $group: { _id: null, gross: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const grossRevenue = revenueResult.length > 0 ? revenueResult[0].gross : 0;

    const ticketTypeSales = await TicketInstance.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(req.params.id), status: { $ne: 'void' } } },
      {
        $lookup: {
          from: 'tickettypes',
          localField: 'ticketType',
          foreignField: '_id',
          as: 'ticketTypeDoc',
        },
      },
      { $unwind: '$ticketTypeDoc' },
      {
        $group: {
          _id: '$ticketTypeDoc.name',
          ticketsSold: { $sum: 1 },
          revenue: { $sum: '$ticketTypeDoc.price' },
        },
      },
      { $sort: { ticketsSold: -1 } },
    ]);

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

    const checkInTrends = await CheckInLog.aggregate([
      {
        $match: { event: new mongoose.Types.ObjectId(req.params.id), result: 'valid' },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const hourlyArrivals = await CheckInLog.aggregate([
      {
        $match: { event: new mongoose.Types.ObjectId(req.params.id), result: 'valid' },
      },
      {
        $group: {
          _id: { $hour: '$scannedAt' },
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
      grossRevenue,
      paidOrders: revenueResult.length > 0 ? revenueResult[0].count : 0,
      ticketTypeSales,
      registrationTrends,
      checkInTrends,
      hourlyArrivals,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/platform — Platform-wide trends with date range (admin only).
 */
exports.getPlatformAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = parseDateRange(req);

    const registrationsOverTime = await Registration.aggregate([
      {
        $match: {
          registeredAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const checkInsOverTime = await CheckInLog.aggregate([
      {
        $match: {
          result: 'valid',
          scannedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenueOverTime = await Order.aggregate([
      {
        $match: {
          status: 'paid',
          updatedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          gross: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const eventsByCategory = await Event.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const topEvents = await Registration.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc',
        },
      },
      { $unwind: '$eventDoc' },
      {
        $group: {
          _id: '$event',
          title: { $first: '$eventDoc.title' },
          registrations: { $sum: 1 },
        },
      },
      { $sort: { registrations: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      range: { start: startDate, end: endDate },
      registrationsOverTime,
      checkInsOverTime,
      revenueOverTime,
      eventsByCategory,
      topEvents,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/organizer — Organizer-scoped analytics across their events.
 */
exports.getOrganizerAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ message: 'Invalid user' });
    }

    const organizerObjectId = new mongoose.Types.ObjectId(String(userId));
    const events = await Event.find({ organizer: organizerObjectId }, '_id title capacity date status');
    const eventIds = events.map((e) => e._id);

    if (eventIds.length === 0) {
      return res.json({
        events: [],
        registrationsOverTime: [],
        checkInsOverTime: [],
        revenueOverTime: [],
        totalConfirmed: 0,
        totalCheckedIn: 0,
        checkInRate: 0,
        capacityUtilization: [],
        grossRevenue: 0,
      });
    }

    const { startDate, endDate } = parseDateRange(req);

    const registrationsOverTime = await Registration.aggregate([
      {
        $match: { event: { $in: eventIds }, registeredAt: { $gte: startDate, $lte: endDate } },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const checkInsOverTime = await CheckInLog.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          result: 'valid',
          scannedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenueOverTime = await Order.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          status: 'paid',
          updatedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          gross: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalConfirmed = await Registration.countDocuments({
      event: { $in: eventIds },
      status: 'confirmed',
    });
    const totalCheckedIn = await Registration.countDocuments({
      event: { $in: eventIds },
      checkedIn: true,
    });
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
          checkedIn: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'r',
                cond: { $eq: ['$$r.checkedIn', true] },
              },
            },
          },
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

    const revenueResult = await Order.aggregate([
      { $match: { event: { $in: eventIds }, status: 'paid' } },
      { $group: { _id: null, gross: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const grossRevenue = revenueResult.length > 0 ? revenueResult[0].gross : 0;

    res.json({
      events,
      registrationsOverTime,
      checkInsOverTime,
      revenueOverTime,
      totalConfirmed,
      totalCheckedIn,
      checkInRate: Math.round(checkInRate * 100) / 100,
      capacityUtilization,
      grossRevenue,
      range: { start: startDate, end: endDate },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/coordinator-performance — Coordinator check-in counts and outcomes.
 * Admin: all. Organizer: their events. Coordinator: self.
 */
exports.getCoordinatorPerformance = async (req, res, next) => {
  try {
    let match = {};
    if (req.user.role === 'organizer') {
      const events = await Event.find({ organizer: req.user.userId }).select('_id');
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      match.scannedBy = req.user.userId;
    }
    // Admin: no filter.

    const { startDate, endDate } = parseDateRange(req);
    match.scannedAt = { $gte: startDate, $lte: endDate };

    const performance = await CheckInLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$scannedBy',
          totalScans: { $sum: 1 },
          validScans: {
            $sum: { $cond: [{ $eq: ['$result', 'valid'] }, 1, 0] },
          },
          failedScans: {
            $sum: { $cond: [{ $ne: ['$result', 'valid'] }, 1, 0] },
          },
          alreadyUsed: { $sum: { $cond: [{ $eq: ['$result', 'already_used'] }, 1, 0] } },
          wrongEvent: { $sum: { $cond: [{ $eq: ['$result', 'wrong_event'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$result', 'cancelled'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: '$userDoc' },
      {
        $project: {
          coordinator: { id: '$userDoc._id', name: '$userDoc.name', email: '$userDoc.email', role: '$userDoc.role' },
          totalScans: 1,
          validScans: 1,
          failedScans: 1,
          alreadyUsed: 1,
          wrongEvent: 1,
          cancelled: 1,
        },
      },
      { $sort: { totalScans: -1 } },
    ]);

    res.json({ performance, range: { start: startDate, end: endDate } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/export/csv — Export registrations as CSV (admin/organizer scoped).
 */
exports.exportRegistrationsCSV = async (req, res, next) => {
  try {
    let match = {};
    if (req.user.role === 'organizer') {
      const events = await Event.find({ organizer: req.user.userId }).select('_id');
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      const assignments = await CoordinatorAssignment.find({ coordinator: req.user.userId }).select('event');
      const eventIds = assignments.map((a) => a.event);
      match.event = { $in: eventIds };
    }
    // Admin: no filter.

    if (req.query.eventId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }
      match.event = req.query.eventId;
    }

    const registrations = await Registration.find(match)
      .populate('user', 'name email')
      .populate('event', 'title')
      .populate('ticketType', 'name')
      .sort({ registeredAt: -1, _id: -1 });

    let csv =
      'Ticket Reference,Attendee Name,Attendee Email,Event,Ticket Type,Status,Check-in Status,Registered At,Checked In At\n';
    registrations.forEach((r) => {
      const name = r.user ? r.user.name.replace(/"/g, '""') : '';
      const email = r.user ? r.user.email.replace(/"/g, '""') : '';
      const eventTitle = r.event && r.event.title ? r.event.title.replace(/"/g, '""') : '';
      const ticketType = r.ticketType ? r.ticketType.name.replace(/"/g, '""') : '';
      const checkInStatus = r.checkedIn ? 'Checked In' : 'Not Checked In';
      const registeredAt = r.registeredAt ? new Date(r.registeredAt).toISOString() : '';
      const checkedInAt = r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '';
      csv += `"${r.ticketNumber}","${name}","${email}","${eventTitle}","${ticketType}","${r.status}","${checkInStatus}","${registeredAt}","${checkedInAt}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
