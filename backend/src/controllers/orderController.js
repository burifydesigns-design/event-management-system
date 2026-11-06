const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketInstance = require('../models/TicketInstance');
const Event = require('../models/Event');
const { issueTicket } = require('../services/ticketService');
const { isValidUuid } = require('../config/supabase');

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
    await TicketType.findByIdAndUpdate(ticketType.id, { quantitySold: ticketType.quantitySold });

    res.status(201).json({ order, tickets });
  } catch (err) {
    next(err);
  }
};

exports.myTickets = async (req, res, next) => {
  try {
    const { rows: tickets } = await TicketInstance.find({
      filter: { attendee: req.user.userId },
      populate: ['event', 'ticketType'],
      sort: { createdAt: -1 },
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.confirmPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId || !isValidUuid(orderId)) {
      return res.status(400).json({ message: 'Valid order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

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

    await Order.findByIdAndUpdate(order.id, { status: 'paid' });

    const issued = [];
    const { rows: ticketInstances } = await TicketInstance.find({ filter: { order: order._id } });
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

    res.json({ message: 'Payment confirmed and tickets issued', order: { ...order, status: 'paid' }, issued });
  } catch (err) {
    next(err);
  }
};
