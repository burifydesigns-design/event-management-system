const User = require('../models/User');
const Event = require('../models/Event');
const CoordinatorAssignment = require('../models/CoordinatorAssignment');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { isValidUuid } = require('../config/supabase');

exports.createAssignment = async (req, res, next) => {
  try {
    const { coordinatorId, eventId } = req.body;

    if (!coordinatorId || !eventId) {
      return res.status(400).json({ message: 'coordinatorId and eventId are required' });
    }
    if (!isValidUuid(coordinatorId) || !isValidUuid(eventId)) {
      return res.status(400).json({ message: 'Invalid coordinator or event ID' });
    }

    const coordinator = await User.findById(coordinatorId);
    if (!coordinator) return res.status(404).json({ message: 'Coordinator user not found' });
    if (coordinator.role !== 'coordinator') {
      return res.status(400).json({ message: 'User is not a coordinator' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to assign coordinators to this event' });
    }

    const assignment = await CoordinatorAssignment.upsert(
      { coordinator: coordinatorId, event: eventId },
      { assignedBy: req.user.userId }
    );

    res.status(201).json({
      message: 'Coordinator assigned to event',
      assignment: {
        id: assignment._id,
        coordinator: coordinatorId,
        event: eventId,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.listAssignments = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query, { defaultLimit: 20 });
    if (pg.error) return res.status(400).json({ message: pg.error });

    let match = {};
    if (req.user.role === 'organizer') {
      const events = await Event.find({ filter: { organizer: req.user.userId }, select: '_id' });
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      match.coordinator = req.user.userId;
    }

    const totalItems = await CoordinatorAssignment.countDocuments(match);
    const { rows: assignments } = await CoordinatorAssignment.find({
      filter: match,
      sort: { assignedAt: -1, _id: -1 },
      skip: pg.skip,
      limit: pg.limit,
    });

    const coordinatorIds = [...new Set(assignments.map((a) => a.coordinator).filter(Boolean))];
    const eventIds = [...new Set(assignments.map((a) => a.event).filter(Boolean))];
    const coordinators = coordinatorIds.length
      ? (await User.find({ filter: { _id: { $in: coordinatorIds } }, select: '_id name email' })).rows
      : [];
    const eventsDocs = eventIds.length
      ? (await Event.find({ filter: { _id: { $in: eventIds } }, select: '_id title date' })).rows
      : [];
    const coordMap = {};
    for (const c of coordinators) coordMap[c._id] = { id: c._id, name: c.name, email: c.email };
    const eventMap = {};
    for (const e of eventsDocs) eventMap[e._id] = { id: e._id, title: e.title, date: e.date };

    const data = assignments.map((a) => ({
      _id: a._id,
      coordinator: coordMap[a.coordinator] || { id: a.coordinator, name: '', email: '' },
      event: eventMap[a.event] || { id: a.event, title: '', date: '' },
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
    }));

    res.json({ data, pagination: buildPaginationMeta({ page: pg.page, limit: pg.limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }

    const assignment = await CoordinatorAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    if (req.user.role === 'organizer') {
      const event = await Event.findById(assignment.event);
      if (!event || String(event.organizer) !== String(req.user.userId)) {
        return res.status(403).json({ message: 'Not authorized to remove this assignment' });
      }
    }

    await CoordinatorAssignment.removeById(assignment.id);
    res.json({ message: 'Coordinator assignment removed' });
  } catch (err) {
    next(err);
  }
};

exports.myEvents = async (req, res, next) => {
  try {
    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Coordinator access required' });
    }

    const { rows: assignments } = await CoordinatorAssignment.find({
      filter: { coordinator: req.user.userId },
      select: 'event',
    });
    const eventIds = assignments.map((a) => a.event);

    if (eventIds.length === 0) {
      return res.json({ data: [] });
    }

    const { rows: events } = await Event.find({
      filter: { _id: { $in: eventIds } },
      select: 'title date time location city capacity status organizer',
      sort: { date: 1, _id: 1 },
    });

    res.json({ data: events });
  } catch (err) {
    next(err);
  }
};

exports.listCoordinators = async (req, res, next) => {
  try {
    const { rows: coordinators } = await User.find({
      filter: { role: 'coordinator', status: 'active' },
      select: 'name email _id',
      sort: { name: 1 },
    });
    res.json({ data: coordinators });
  } catch (err) {
    next(err);
  }
};
