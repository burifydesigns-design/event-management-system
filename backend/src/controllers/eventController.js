const Event = require('../models/Event');
const mongoose = require('mongoose');

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseDate = (dateString) => {
  if (!dateString) return null;
  // Parse as UTC to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) return null;
  return date;
};

exports.listEvents = async (req, res, next) => {
  try {
    const {
      search,
      category,
      city,
      date,
      price,
      page = 1,
      limit = 12,
      sort = 'date_asc'
    } = req.query;

    const query = { status: 'published', visibility: 'public' };

    if (search) {
      const sanitizedSearch = escapeRegex(search.trim());
      if (sanitizedSearch) {
        query.$or = [
          { title: { $regex: sanitizedSearch, $options: 'i' } },
          { description: { $regex: sanitizedSearch, $options: 'i' } },
          { city: { $regex: sanitizedSearch, $options: 'i' } },
          { location: { $regex: sanitizedSearch, $options: 'i' } },
          { category: { $regex: sanitizedSearch, $options: 'i' } }
        ];
      }
    }

    if (category) {
      query.category = { $regex: `^${escapeRegex(category.trim())}$`, $options: 'i' };
    }

    if (city) {
      query.city = { $regex: `^${escapeRegex(city.trim())}$`, $options: 'i' };
    }

    if (date) {
      const parsedDate = parseDate(date);
      if (parsedDate) {
        const nextDay = new Date(parsedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.date = { $gte: parsedDate, $lt: nextDay };
      } else if (date === 'upcoming') {
        query.date = { $gte: today() };
      } else if (date === 'past') {
        query.date = { $lt: today() };
      }
    }

    if (price === 'free') {
      query.price = 0;
    } else if (price === 'paid') {
      query.price = { $gt: 0 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));

    let sortOption = { date: 1 };
    if (sort === 'date_desc') sortOption = { date: -1 };
    else if (sort === 'title_asc') sortOption = { title: 1 };
    else if (sort === 'title_desc') sortOption = { title: -1 };
    else if (sort === 'price_asc') sortOption = { price: 1 };
    else if (sort === 'price_desc') sortOption = { price: -1 };

    const totalEvents = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort(sortOption);

    res.json({
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalEvents,
        totalPages: Math.ceil(totalEvents / limitNum)
      }
    });
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

    const isPublicPublished = event.status === 'published' && event.visibility === 'public';
    const isOwner = req.user && String(event.organizer._id) === String(req.user.userId);
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isPublicPublished && !isOwner && !isAdmin) {
      return res.status(404).json({ message: 'Event not found' });
    }

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
