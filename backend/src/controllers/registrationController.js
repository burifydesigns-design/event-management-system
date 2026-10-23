const Event = require('../models/Event');
const Registration = require('../models/Registration');
const mongoose = require('mongoose');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { generateTicketToken } = require('../services/qrService');
const { sendTicketEmail } = require('../services/emailService');
const TicketEmailLog = require('../models/TicketEmailLog');

function generateTicketNumber() {
  return 'EVT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: 'Invalid event ID' });
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') return res.status(400).json({ message: 'Event is not published' });
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(event.date) < today) return res.status(400).json({ message: 'Event is in the past' });
    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }
    const existingRegistration = await Registration.findOne({ user: req.user.userId, event: eventId });
    if (existingRegistration) return res.status(409).json({ message: 'Already registered for this event' });
    const currentRegistrations = await Registration.countDocuments({ event: eventId, status: 'confirmed' });
    if (currentRegistrations >= event.capacity) return res.status(409).json({ message: 'Event is full' });
    const ticketNumber = generateTicketNumber();
    const qrToken = generateTicketToken();
    let registration;
    try {
      registration = await Registration.create({
        user: req.user.userId,
        event: eventId,
        ticketNumber,
        qrToken,
        status: 'confirmed',
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'Already registered for this event' });
      throw err;
    }

    // Queue the ticket email (non-blocking). Delivery tracked via TicketEmailLog.
    const emailLog = await TicketEmailLog.create({
      registration: registration._id,
      status: 'pending',
      attempts: 0,
    });
    sendTicketEmail(registration, emailLog._id).catch(function() {});

    try { await event.populate('organizer', 'name email'); } catch(e){}
    const eventDetails = { name: event.title, date: event.date, time: event.time, location: event.location, city: event.city };
    if (req.user.email) {
      const { sendRegistrationEmail } = require('../services/emailService');
      sendRegistrationEmail(req.user.email, eventDetails, ticketNumber).catch(function(){});
    }
    res.status(201).json({ ...registration.toObject(), event: { id: event._id, title: event.title, date: event.date, time: event.time, location: event.location, city: event.city } });
  } catch (err) { next(err); }
};

const MY_EVENTS_TABS = ['upcoming', 'past', 'cancelled', 'all'];

exports.getMyEvents = async (req, res, next) => {
  try {
    const pg = parsePagination(req.query, { defaultLimit: 10 });
    const page = pg.page, limit = pg.limit, skip = pg.skip, error = pg.error;
    if (error) return res.status(400).json({ message: error });
    const tab = req.query.tab || 'all';
    if (MY_EVENTS_TABS.indexOf(tab) === -1) return res.status(400).json({ message: 'Invalid tab. Use upcoming, past, cancelled, or all' });
    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) return res.status(401).json({ message: 'Invalid user' });
    const userObjectId = new mongoose.Types.ObjectId(String(req.user.userId));
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const baseMatch = { user: userObjectId };
    let tabMatch = {};
    if (tab === 'upcoming') tabMatch = { status: 'confirmed', 'eventDoc.date': { $gte: startOfToday } };
    else if (tab === 'past') tabMatch = { status: 'confirmed', $or: [{ 'eventDoc.date': { $lt: startOfToday } }, { 'eventDoc.date': null }] };
    else if (tab === 'cancelled') tabMatch = { status: 'cancelled' };
    const lookupStage = { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'eventDoc' } };
    const unwindStage = { $unwind: { path: '$eventDoc', preserveNullAndEmptyArrays: true } };
    const countResult = await Registration.aggregate([{ $match: baseMatch }, lookupStage, unwindStage, { $match: tabMatch }, { $count: 'totalItems' }]);
    const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
    const data = await Registration.aggregate([{ $match: baseMatch }, lookupStage, unwindStage, { $match: tabMatch }, { $sort: { registeredAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }, { $addFields: { event: '$eventDoc' } }, { $project: { eventDoc: 0 } }]);
    const countsResult = await Registration.aggregate([{ $match: baseMatch }, lookupStage, unwindStage, { $group: { _id: null, upcoming: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'confirmed'] }, { $gte: ['$eventDoc.date', startOfToday] }] }, 1, 0] } }, past: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'confirmed'] }, { $or: [{ $lt: ['$eventDoc.date', startOfToday] }, { $eq: ['$eventDoc.date', null] }] }] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }]);
    const counts = countsResult.length > 0 ? { upcoming: countsResult[0].upcoming, past: countsResult[0].past, cancelled: countsResult[0].cancelled } : { upcoming: 0, past: 0, cancelled: 0 };
    res.json({ data: data, pagination: buildPaginationMeta({ page: page, limit: limit, totalItems: totalItems }), counts: counts });
  } catch (err) { next(err); }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    if (String(registration.user) !== String(req.user.userId) && req.user.role !== 'admin' && req.user.role !== 'organizer') return res.status(403).json({ message: 'Not authorized' });
    const event = await Event.findById(registration.event);
    const today = new Date(); today.setHours(0,0,0,0);
    if (event && new Date(event.date) < today) return res.status(400).json({ message: 'Cannot cancel registration for past event' });
    if (String(registration.user) === String(req.user.userId)) { registration.status = 'cancelled'; await registration.save(); }
    else { await registration.deleteOne(); }
    res.json({ message: 'Registration cancelled' });
  } catch (err) { next(err); }
};

exports.getRegistration = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const registration = await Registration.findById(req.params.id)
      .populate('event', 'title date time location city status capacity organizer')
      .populate('user', 'name email role');
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    const event = registration.event;
    const isOwner = String(registration.user._id) === String(req.user.userId);
    const isStaff = req.user.role === 'admin' || String(event.organizer) === String(req.user.userId);
    if (!isOwner && !isStaff) return res.status(403).json({ message: 'Not authorized' });
    res.json({
      ...registration.toObject(),
      event: { id: event._id, title: event.title, date: event.date, time: event.time, location: event.location, city: event.city, status: event.status },
      user: { id: registration.user._id, name: registration.user.name, email: registration.user.email, role: registration.user.role },
    });
  } catch (err) { next(err); }
};
