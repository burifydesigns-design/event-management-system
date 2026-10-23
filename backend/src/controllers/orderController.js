const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketInstance = require('../models/TicketInstance');
const { issueTicket } = require('../services/ticketService');

// Attendee creates an order for ticket(s). Order starts as pending; tickets are
// issued only after payment is confirmed.
exports.createOrder = async (req, res, next) => {
  try {
    const { eventId, ticketTypeId, quantity } = req.body;
    if (!eventId || !ticketTypeId || !quantity) {
      return res.status(400).json({ message: 'eventId, ticketTypeId, and quantity are required' });
    }

    const ticketType = await TicketType.findById(ticketTypeId);
    if (!ticketType) return res.status(404).json({ message: 'Ticket type not found' });

    const totalAmount = ticketType.price * Number(quantity);
    const order = await Order.create({
      attendee: req.user.userId,
      event: eventId,
      totalAmount,
      status: 'pending',
    });

    const tickets = [];
    for (let i = 0; i < Number(quantity); i++) {
      const ticket = await TicketInstance.create({
        order: order._id,
        ticketType: ticketType._id,
        event: eventId,
        attendee: req.user.userId,
        status: 'pending',
      });
      tickets.push(ticket);
    }

    ticketType.quantitySold += Number(quantity);
    await ticketType.save();

    res.status(201).json({ order, tickets });
  } catch (err) {
    next(err);
  }
};

// Attendee: list their own tickets (TicketInstances).
exports.myTickets = async (req, res, next) => {
  try {
    const tickets = await TicketInstance.find({ attendee: req.user.userId })
      .populate('event ticketType')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

// Organizer/admin: confirm payment for an order and issue tickets.
// In production this would be triggered by a verified payment webhook.
exports.confirmPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId || !require('mongoose').Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Valid order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Authorization: admin, or the order owner (attendee confirming their own),
    // or organizer of the event.
    const Event = require('../models/Event');
    const event = await Event.findById(order.event);
    const isOwner = String(order.attendee) === String(req.user.userId);
    const isAdmin = req.user.role === 'admin';
    const isOrganizer = event && String(event.organizer) === String(req.user.userId);
    if (!isOwner && !isAdmin && !isOrganizer) {
      return res.status(403).json({ message: 'Not authorized to confirm this order' });
    }

    if (order.status === 'paid') {
      return res.status(409).json({ message: 'Order already paid' });
    }

    order.status = 'paid';
    await order.save();

    // Issue a Registration ticket for each TicketInstance in this order.
    const issued = [];
    const ticketInstances = await TicketInstance.find({ order: order._id });
    for (const ti of ticketInstances) {
      try {
        const result = await issueTicket({
          userId: order.attendee,
          eventId: order.event,
          ticketTypeId: ti.ticketType,
          orderId: order._id,
        });
        issued.push(result);
      } catch (err) {
        console.error('Failed to issue ticket for order', orderId, ':', err.message);
      }
    }

    res.json({ message: 'Payment confirmed and tickets issued', order, issued });
  } catch (err) {
    next(err);
  }
};
