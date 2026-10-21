const Event = require('../models/Event');
const mongoose = require('mongoose');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

exports.listEvents = async (req, res, next) => {
  try {
    const { search, category, city, date, price } = req.query;
    const { page, limit, skip, error } = parsePagination(req.query);
    if (error) return res.status(400).json({ message: error });

    const query = { status: 'published' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (city) query.city = { $regex: city, $options: 'i' };
    if (date === 'upcoming') query.date = { $gte: today() };
    if (date === 'past') query.date = { $lt: today() };
    if (price === 'free') query.price = 0;
    if (price === 'paid') query.price = { $gt: 0 };

    const totalEvents = await Event.countDocuments(query);
    // Deterministic sort with a unique tie-breaker (_id) so records are not
    // duplicated or skipped across page boundaries.
    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ date: 1, _id: 1 })
      .skip(skip)
      .limit(limit);

    const pagination = buildPaginationMeta({ page, limit, totalItems: totalEvents });

    // Legacy fields (page, limit, totalEvents, totalPages) are kept for
    // backward compatibility with existing consumers; new consumers should
    // use the `pagination` object.
    res.json({ events, page, limit, totalEvents, totalPages: pagination.totalPages, pagination });
  } catch (err) {
    next(err);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id).populate('organizer', 'name email');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, organizer: req.user.userId });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (String(event.organizer) !== String(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your event' });
    }
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (String(event.organizer) !== String(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your event' });
    }
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

exports.publishEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (String(event.organizer) !== String(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your event' });
    }
    event.status = event.status === 'published' ? 'draft' : 'published';
    await event.save();
    res.json(event);
  } catch (err) {
    next(err);
  }
};
