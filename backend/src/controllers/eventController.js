const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Order = require('../models/Order');
const TicketInstance = require('../models/TicketInstance');
const TicketType = require('../models/TicketType');
const User = require('../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { canManageEvent } = require('../utils/eventPermissions');

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

exports.listEvents = async (req, res, next) => {
  try {
    const { search, category, city, date, price, page = 1, limit = 12 } = req.query;
    const query = { status: 'published' };

    const escapeRegex = (text) => {
      if (!text) return '';
      return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    };

    if (search) {
      const s = escapeRegex(search);
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (city) {
      query.city = { $regex: escapeRegex(city), $options: 'i' };
    }
    if (date === 'upcoming') query.date = { $gte: today() };
    if (date === 'past') query.date = { $lt: today() };
    if (price === 'free') query.price = 0;
    if (price === 'paid') query.price = { $gt: 0 };

    const totalEvents = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .skip((page - 1) * Number(limit))
      .limit(Math.min(Number(limit) || 12, 100))
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
    
    // Check if event is published or if user owns it
    if (event.status !== 'published') {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        let decoded;
        try {
          const token = authHeader.split(' ')[1];
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
          return res.status(404).json({ message: 'Event not found' });
        }
        const user = await User.findById(decoded.userId).select('_id role');
        if (!user || !canManageEvent(user, event)) {
          return res.status(404).json({ message: 'Event not found' });
        }
      } else {
        return res.status(404).json({ message: 'Event not found' });
      }
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const eventData = {
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      category: req.body.category.trim(),
      date: req.body.date,
      time: req.body.time,
      location: req.body.location.trim(),
      city: req.body.city.trim(),
      capacity: Number(req.body.capacity),
      price: req.body.price === '' || req.body.price === undefined || req.body.price === null
        ? 0
        : Number(req.body.price),
      image: req.body.image || '',
      organizer: req.user.userId,
    };
    if (req.body.status && req.user.role === 'admin') {
      eventData.status = req.body.status;
    }
    const event = await Event.create(eventData);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not your event' });
    }
    if (event.status === 'cancelled' && req.body.status && req.body.status !== 'cancelled') {
      return res.status(400).json({ message: 'Cancelled events cannot be reactivated' });
    }

    const fields = ['title', 'description', 'category', 'date', 'time', 'location', 'city', 'capacity', 'price', 'image'];
    const updates = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = ['capacity', 'price'].includes(field) ? Number(req.body[field]) : req.body[field];
      }
    }
    if (req.user.role === 'admin' && req.body.status !== undefined) {
      updates.status = req.body.status;
    }

    const activeRegistrations = await Registration.countDocuments({
      event: event._id,
      status: { $in: ['confirmed', 'checked-in'] },
    });
    if (updates.capacity !== undefined && updates.capacity < activeRegistrations) {
      return res.status(400).json({ message: 'Capacity cannot be lower than active registrations' });
    }

    Object.assign(event, updates);
    const updated = await event.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not your event' });
    }

    const relatedRecordCounts = await Promise.all([
      Registration.countDocuments({ event: event._id }),
      Order.countDocuments({ event: event._id }),
      TicketInstance.countDocuments({ event: event._id }),
      TicketType.countDocuments({ event: event._id }),
    ]);
    if (relatedRecordCounts.some((count) => count > 0)) {
      event.status = 'cancelled';
      await event.save();
      return res.json({
        message: 'Event cancelled to preserve its registration and ticket records',
        status: event.status,
        cancelled: true,
      });
    }

    await event.deleteOne();
    res.json({ message: 'Event deleted', deleted: true });
  } catch (err) {
    next(err);
  }
};

exports.publishEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ message: 'Not your event' });
    }
    if (event.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled events cannot be published' });
    }
    event.status = event.status === 'published' ? 'draft' : 'published';
    await event.save();
    res.json(event);
  } catch (err) {
    next(err);
  }
};
