const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketInstance = require('../models/TicketInstance');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { generateTicketToken, generateQRImage } = require('../services/qrService');

// Attendee buys ticket(s)
exports.createOrder = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Order details are required' });
    }
    const { eventId, ticketTypeId, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(ticketTypeId)) {
      return res.status(400).json({ message: 'Valid event and ticket type IDs are required' });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    const ticketType = await TicketType.findById(ticketTypeId);
    if (!ticketType) return res.status(404).json({ message: 'Ticket type not found' });
    if (String(ticketType.event) !== String(eventId)) {
      return res.status(400).json({ message: 'Ticket type does not belong to this event' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.status !== 'published') {
      return res.status(400).json({ message: 'Event is not available for ticket orders' });
    }
    if (new Date(event.date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Event is in the past' });
    }
    if (Number(quantity) > ticketType.quantityAvailable - ticketType.quantitySold) {
      return res.status(400).json({ message: 'Not enough tickets are available' });
    }

    const totalAmount = ticketType.price * Number(quantity);
    const order = await Order.create({
      attendee: req.user.userId || req.user._id,
      event: eventId,
      totalAmount,
      status: 'paid', // TODO: set to 'pending' once paymentService is wired up
    });

    const tickets = [];
    for (let i = 0; i < Number(quantity); i++) {
      const qrToken = generateTicketToken();
      const ticket = await TicketInstance.create({
        order: order._id,
        ticketType: ticketType._id,
        event: eventId,
        attendee: req.user.userId || req.user._id,
        qrToken,
      });
      const qrImage = await generateQRImage(qrToken);
      tickets.push({ ...ticket.toObject(), qrImage });
    }

    ticketType.quantitySold += quantity;
    await ticketType.save();

    res.status(201).json({ order, tickets });
  } catch (err) {
    next(err);
  }
};

exports.myTickets = async (req, res, next) => {
  try {
    const tickets = await TicketInstance.find({ attendee: req.user.userId || req.user._id }).populate('event ticketType');
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};
