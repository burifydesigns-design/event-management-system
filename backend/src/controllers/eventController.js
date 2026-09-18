const Event = require('../models/Event');
const mongoose = require('mongoose');

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

exports.listEvents = async (req, res, next) => {
  try {
    const { search, category, city, date, price, page = 1, limit = 12 } = req.query;
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
    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ date: 1 });

    res.json({ events, page: Number(page), limit: Number(limit), totalEvents, totalPages: Math.ceil(totalEvents / limit) });
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
    const eventData = { ...req.body, organizer: req.user.userId };
    if (eventData.price === '' || eventData.price === undefined || eventData.price === null) {
      eventData.price = 0;
    } else {
      eventData.price = Number(eventData.price);
    }
    const event = await Event.create(eventData);
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
