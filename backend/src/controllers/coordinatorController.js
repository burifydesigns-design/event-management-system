const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const CoordinatorAssignment = require('../models/CoordinatorAssignment');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * POST /api/coordinator/assignments — Assign a coordinator to an event.
 * Admin: any coordinator to any event. Organizer: only their own events.
 */
exports.createAssignment = async (req, res, next) => {
  try {
    const { coordinatorId, eventId } = req.body;

    if (!coordinatorId || !eventId) {
      return res.status(400).json({ message: 'coordinatorId and eventId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(coordinatorId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid coordinator or event ID' });
    }

    const coordinator = await User.findById(coordinatorId);
    if (!coordinator) return res.status(404).json({ message: 'Coordinator user not found' });
    if (coordinator.role !== 'coordinator') {
      return res.status(400).json({ message: 'User is not a coordinator' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Organizers can only assign coordinators to their own events. Admins can assign to any.
    if (req.user.role === 'organizer' && String(event.organizer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to assign coordinators to this event' });
    }

    const assignment = await CoordinatorAssignment.findOneAndUpdate(
      { coordinator: coordinatorId, event: eventId },
      { $setOnInsert: { assignedBy: req.user.userId } },
      { upsert: true, new: true }
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
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Coordinator already assigned to this event' });
    }
    next(err);
  }
};

/**
 * GET /api/coordinator/assignments — List assignments.
 * Admin: all. Organizer: their own events. Coordinator: their own assignments.
 */
exports.listAssignments = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query, { defaultLimit: 20 });
    if (pg.error) return res.status(400).json({ message: pg.error });

    let match = {};
    if (req.user.role === 'organizer') {
      const events = await Event.find({ organizer: req.user.userId }).select('_id');
      const eventIds = events.map((e) => e._id);
      match.event = { $in: eventIds };
    } else if (req.user.role === 'coordinator') {
      match.coordinator = req.user.userId;
    }
    // Admin: no filter (all).

    const [result] = await CoordinatorAssignment.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'coordinator',
          foreignField: '_id',
          as: 'coordinatorDoc',
        },
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc',
        },
      },
      { $unwind: { path: '$coordinatorDoc', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$eventDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          coordinator: { id: '$coordinatorDoc._id', name: '$coordinatorDoc.name', email: '$coordinatorDoc.email' },
          event: { id: '$eventDoc._id', title: '$eventDoc.title', date: '$eventDoc.date' },
          assignedAt: 1,
          assignedBy: 1,
        },
      },
      { $sort: { assignedAt: -1, _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalItems' }],
          data: [{ $skip: pg.skip }, { $limit: pg.limit }],
        },
      },
    ]);

    const totalItems = (result && result.metadata && result.metadata[0] && result.metadata[0].totalItems) || 0;
    const data = (result && result.data) || [];

    res.json({ data, pagination: buildPaginationMeta({ page: pg.page, limit: pg.limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/coordinator/assignments/:id — Remove a coordinator assignment.
 */
exports.deleteAssignment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }

    const assignment = await CoordinatorAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Organizers can only remove assignments for their own events.
    if (req.user.role === 'organizer') {
      const event = await Event.findById(assignment.event);
      if (!event || String(event.organizer) !== String(req.user.userId)) {
        return res.status(403).json({ message: 'Not authorized to remove this assignment' });
      }
    }

    await assignment.deleteOne();
    res.json({ message: 'Coordinator assignment removed' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/coordinator/me/events — Events assigned to the authenticated coordinator.
 */
exports.myEvents = async (req, res, next) => {
  try {
    if (req.user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Coordinator access required' });
    }

    const assignments = await CoordinatorAssignment.find({ coordinator: req.user.userId }).select('event');
    const eventIds = assignments.map((a) => a.event);

    if (eventIds.length === 0) {
      return res.json({ data: [] });
    }

    const events = await Event.find({ _id: { $in: eventIds } })
      .select('title date time location city capacity status organizer')
      .sort({ date: 1, _id: 1 });

    res.json({ data: events });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/coordinator/available-coordinators — List users with coordinator role (admin/organizer lookup).
 */
exports.listCoordinators = async (req, res, next) => {
  try {
    const coordinators = await User.find({ role: 'coordinator', status: 'active' })
      .select('name email _id')
      .sort({ name: 1 });
    res.json({ data: coordinators });
  } catch (err) {
    next(err);
  }
};
