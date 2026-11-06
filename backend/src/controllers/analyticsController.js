const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Order = require('../models/Order');
const TicketInstance = require('../models/TicketInstance');
const CheckInLog = require('../models/CheckInLog');
const CoordinatorAssignment = require('../models/CoordinatorAssignment');
const TicketType = require('../models/TicketType');
const User = require('../models/User');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { isValidUuid } = require('../config/supabase');

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

function groupByDate(rows, dateField) {
  const map = {};
  for (const r of rows) {
    const day = new Date(r[dateField]).toISOString().slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  }
  return Object.entries(map)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => a._id.localeCompare(b._id));
}

exports.getOverview = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const upcomingEvents = await Event.countDocuments({
      status: 'published',
      date: { $gte: new Date() },
    });

    const totalRegistrations = await Registration.countDocuments();
    const confirmedRegistrations = await Registration.countDocuments({ status: 'confirmed' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
    const checkedInRegistrations = await Registration.countDocuments({ checkedIn: true });

    const attendanceRate = confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;

    const { rows: paidOrders } = await Order.find({ filter: { status: 'paid' }, select: 'total_amount' });
    let grossRevenue = 0;
    for (const o of paidOrders) grossRevenue += Number(o.total_amount || 0);
    const paidOrdersCount = paidOrders.length;

    const { rows: allRegs } = await Registration.find({ select: 'registered_at' });
    const registrationTrends = groupByDate(allRegs, 'registered_at');

    const { rows: validCheckins } = await CheckInLog.find({
      filter: { result: 'valid' },
      select: 'scanned_at',
    });
    const checkInTrends = groupByDate(validCheckins, 'scanned_at');

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
      paidOrders: paidOrdersCount,
      registrationTrends,
      checkInTrends,
    });
  } catch (err) {
    next(err);
  }
};

exports.getEventAnalytics = async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const authorized = await isEventStaff(req.user, event);
    if (!authorized) {
      return res.status(403).json({ message: 'Not authorized to view analytics for this event' });
    }

    const eventId = req.params.id;

    const totalRegistrations = await Registration.countDocuments({ event: eventId });
    const confirmedRegistrations = await Registration.countDocuments({
      event: eventId,
      status: 'confirmed',
    });
    const cancelledRegistrations = await Registration.countDocuments({
      event: eventId,
      status: 'cancelled',
    });
    const checkedInRegistrations = await Registration.countDocuments({
      event: eventId,
      checkedIn: true,
    });

    const attendanceRate = confirmedRegistrations > 0 ? (checkedInRegistrations / confirmedRegistrations) * 100 : 0;
    const capacityUtilization = event.capacity > 0 ? (confirmedRegistrations / event.capacity) * 100 : 0;

    const { rows: paidOrders } = await Order.find({
      filter: { event: eventId, status: 'paid' },
      select: 'total_amount',
    });
    let grossRevenue = 0;
    for (const o of paidOrders) grossRevenue += Number(o.total_amount || 0);

    const { rows: ticketInstances } = await TicketInstance.find({
      filter: { event: eventId, status: { $ne: 'void' } },
      select: 'ticket_type',
    });
    const ticketTypeIds = [...new Set(ticketInstances.map((t) => t.ticket_type).filter(Boolean))];
    const ticketTypes = ticketTypeIds.length
      ? (await TicketType.find({ filter: { _id: { $in: ticketTypeIds } }, select: '_id name price' })).rows
      : [];
    const ttMap = {};
    for (const tt of ticketTypes) {
      ttMap[tt._id] = { name: tt.name, price: Number(tt.price || 0) };
    }
    const ttSalesMap = {};
    for (const ti of ticketInstances) {
      const info = ttMap[ti.ticket_type];
      if (!info) continue;
      if (!ttSalesMap[info.name]) ttSalesMap[info.name] = { ticketsSold: 0, revenue: 0 };
      ttSalesMap[info.name].ticketsSold += 1;
      ttSalesMap[info.name].revenue += info.price;
    }
    const ticketTypeSales = Object.entries(ttSalesMap)
      .map(([name, v]) => ({ _id: name, ticketsSold: v.ticketsSold, revenue: v.revenue }))
      .sort((a, b) => b.ticketsSold - a.ticketsSold);

    const { rows: eventRegs } = await Registration.find({
      filter: { event: eventId },
      select: 'registered_at',
    });
    const registrationTrends = groupByDate(eventRegs, 'registered_at');

    const { rows: validEventCheckins } = await CheckInLog.find({
      filter: { event: eventId, result: 'valid' },
      select: 'scanned_at',
    });
    const checkInTrends = groupByDate(validEventCheckins, 'scanned_at');

    const hourMap = {};
    for (const c of validEventCheckins) {
      const hour = new Date(c.scanned_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    }
    const hourlyArrivals = Object.entries(hourMap)
      .map(([_id, count]) => ({ _id: Number(_id), count }))
      .sort((a, b) => a._id - b._id);

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
      paidOrders: paidOrders.length,
      ticketTypeSales,
      registrationTrends,
      checkInTrends,
      hourlyArrivals,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPlatformAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = parseDateRange(req);

    const { rows: regsOverTime } = await Registration.find({
      filter: { registeredAt: { $gte: startDate, $lte: endDate } },
      select: 'registered_at',
    });
    const registrationsOverTime = groupByDate(regsOverTime, 'registered_at');

    const { rows: checkIns } = await CheckInLog.find({
      filter: { result: 'valid', scannedAt: { $gte: startDate, $lte: endDate } },
      select: 'scanned_at',
    });
    const checkInsOverTime = groupByDate(checkIns, 'scanned_at');

    const { rows: paidOrders } = await Order.find({
      filter: { status: 'paid', updatedAt: { $gte: startDate, $lte: endDate } },
      select: 'updated_at total_amount',
    });
    const revenueMap = {};
    let revenueCount = 0;
    for (const o of paidOrders) {
      const day = new Date(o.updated_at).toISOString().slice(0, 10);
      if (!revenueMap[day]) revenueMap[day] = { gross: 0, count: 0 };
      revenueMap[day].gross += Number(o.total_amount || 0);
      revenueMap[day].count += 1;
      revenueCount += 1;
    }
    const revenueOverTime = Object.entries(revenueMap)
      .map(([_id, v]) => ({ _id, gross: v.gross, count: v.count }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const { rows: events } = await Event.find({ filter: { status: 'published' }, select: 'category' });
    const categoryMap = {};
    for (const e of events) categoryMap[e.category] = (categoryMap[e.category] || 0) + 1;
    const eventsByCategory = Object.entries(categoryMap)
      .map(([_id, count]) => ({ _id, count }))
      .sort((a, b) => b.count - a.count);

    const { rows: confirmedRegs } = await Registration.find({
      filter: { status: 'confirmed' },
      select: 'event',
    });
    const perEventMap = {};
    for (const r of confirmedRegs) {
      perEventMap[r.event] = (perEventMap[r.event] || 0) + 1;
    }
    const topEventIds = Object.entries(perEventMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventId]) => eventId);
    const topEvents = [];
    if (topEventIds.length) {
      const { rows: topEventsDocs } = await Event.find({
        filter: { _id: { $in: topEventIds } },
        select: '_id title',
      });
      const titleMap = {};
      for (const e of topEventsDocs) titleMap[e._id] = e.title;
      for (const eventId of topEventIds) {
        topEvents.push({ _id: eventId, title: titleMap[eventId] || '', registrations: perEventMap[eventId] });
      }
    }

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

exports.getOrganizerAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    if (!isValidUuid(String(userId))) {
      return res.status(400).json({ message: 'Invalid user' });
    }

    const { rows: events } = await Event.find({
      filter: { organizer: userId },
      select: '_id title capacity date status',
    });
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

    const { rows: regsOverTime } = await Registration.find({
      filter: { event: { $in: eventIds }, registeredAt: { $gte: startDate, $lte: endDate } },
      select: 'registered_at',
    });
    const registrationsOverTime = groupByDate(regsOverTime, 'registered_at');

    const { rows: checkIns } = await CheckInLog.find({
      filter: {
        event: { $in: eventIds },
        result: 'valid',
        scannedAt: { $gte: startDate, $lte: endDate },
      },
      select: 'scanned_at',
    });
    const checkInsOverTime = groupByDate(checkIns, 'scanned_at');

    const { rows: paidOrders } = await Order.find({
      filter: {
        event: { $in: eventIds },
        status: 'paid',
        updatedAt: { $gte: startDate, $lte: endDate },
      },
      select: 'updated_at total_amount',
    });
    const revenueMap = {};
    for (const o of paidOrders) {
      const day = new Date(o.updated_at).toISOString().slice(0, 10);
      if (!revenueMap[day]) revenueMap[day] = { gross: 0, count: 0 };
      revenueMap[day].gross += Number(o.total_amount || 0);
      revenueMap[day].count += 1;
    }
    const revenueOverTime = Object.entries(revenueMap)
      .map(([_id, v]) => ({ _id, gross: v.gross, count: v.count }))
      .sort((a, b) => a._id.localeCompare(b._id));

    const totalConfirmed = await Registration.countDocuments({
      event: { $in: eventIds },
      status: 'confirmed',
    });
    const totalCheckedIn = await Registration.countDocuments({
      event: { $in: eventIds },
      checkedIn: true,
    });
    const checkInRate = totalConfirmed > 0 ? (totalCheckedIn / totalConfirmed) * 100 : 0;

    const { rows: capRegs } = await Registration.find({
      filter: { event: { $in: eventIds }, status: 'confirmed' },
      select: 'event checked_in',
    });
    const regCountByEvent = {};
    const checkedInByEvent = {};
    for (const r of capRegs) {
      regCountByEvent[r.event] = (regCountByEvent[r.event] || 0) + 1;
      if (r.checkedIn === true) checkedInByEvent[r.event] = (checkedInByEvent[r.event] || 0) + 1;
    }
    const capacityUtilization = events.map((e) => {
      const registered = regCountByEvent[e._id] || 0;
      const checkedIn = checkedInByEvent[e._id] || 0;
      const utilization = e.capacity === 0 ? 0 : (registered / e.capacity) * 100;
      return { title: e.title, capacity: e.capacity, registered, checkedIn, utilization };
    });

    const { rows: grossOrders } = await Order.find({
      filter: { event: { $in: eventIds }, status: 'paid' },
      select: 'total_amount',
    });
    let grossRevenue = 0;
    for (const o of grossOrders) grossRevenue += Number(o.total_amount || 0);

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

exports.getCoordinatorPerformance = async (req, res, next) => {
  try {
    let match = {};
    if (req.user.role === 'organizer') {
      const { rows: events } = await Event.find({ filter: { organizer: req.user.userId }, select: '_id' });
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      match.scannedBy = req.user.userId;
    }

    const { startDate, endDate } = parseDateRange(req);
    match.scannedAt = { $gte: startDate, $lte: endDate };

    const { rows: logs } = await CheckInLog.find({ filter: match, select: 'scanned_by result' });

    const byStaff = {};
    for (const c of logs) {
      if (!byStaff[c.scanned_by]) {
        byStaff[c.scanned_by] = {
          totalScans: 0,
          validScans: 0,
          failedScans: 0,
          alreadyUsed: 0,
          wrongEvent: 0,
          cancelled: 0,
        };
      }
      const s = byStaff[c.scanned_by];
      s.totalScans += 1;
      if (c.result === 'valid') s.validScans += 1;
      else s.failedScans += 1;
      if (c.result === 'already_used') s.alreadyUsed += 1;
      if (c.result === 'wrong_event') s.wrongEvent += 1;
      if (c.result === 'cancelled') s.cancelled += 1;
    }

    const staffIds = Object.keys(byStaff);
    const staffDocs = staffIds.length
      ? (await User.find({ filter: { _id: { $in: staffIds } }, select: '_id name email role' })).rows
      : [];
    const staffMap = {};
    for (const s of staffDocs) staffMap[s._id] = { id: s._id, name: s.name, email: s.email, role: s.role };

    const performance = Object.entries(byStaff)
      .map(([scannedBy, v]) => ({
        coordinator: staffMap[scannedBy] || { id: scannedBy, name: '', email: '', role: '' },
        totalScans: v.totalScans,
        validScans: v.validScans,
        failedScans: v.failedScans,
        alreadyUsed: v.alreadyUsed,
        wrongEvent: v.wrongEvent,
        cancelled: v.cancelled,
      }))
      .sort((a, b) => b.totalScans - a.totalScans);

    res.json({ performance, range: { start: startDate, end: endDate } });
  } catch (err) {
    next(err);
  }
};

exports.exportRegistrationsCSV = async (req, res, next) => {
  try {
    let match = {};
    if (req.user.role === 'organizer') {
      const { rows: events } = await Event.find({ filter: { organizer: req.user.userId }, select: '_id' });
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      const { rows: assignments } = await CoordinatorAssignment.find({
        filter: { coordinator: req.user.userId },
        select: 'event',
      });
      const eventIds = assignments.map((a) => a.event);
      match.event = { $in: eventIds };
    }

    if (req.query.eventId) {
      if (!isValidUuid(req.query.eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }
      match.event = req.query.eventId;
    }

    const { rows: registrations } = await Registration.find({
      filter: match,
      populate: [
        { path: 'user', fields: 'name email' },
        { path: 'event', fields: 'title' },
        { path: 'ticketType', fields: 'name' },
      ],
      sort: { registeredAt: -1, _id: -1 },
    });

    let csv =
      'Ticket Reference,Attendee Name,Attendee Email,Event,Ticket Type,Status,Check-in Status,Registered At,Checked In At\n';
    registrations.forEach((r) => {
      const name = r.user ? String(r.user.name).replace(/"/g, '""') : '';
      const email = r.user ? String(r.user.email).replace(/"/g, '""') : '';
      const eventTitle = r.event && r.event.title ? String(r.event.title).replace(/"/g, '""') : '';
      const ticketType = r.ticketType ? String(r.ticketType.name).replace(/"/g, '""') : '';
      const checkInStatus = r.checkedIn === true ? 'Checked In' : 'Not Checked In';
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
