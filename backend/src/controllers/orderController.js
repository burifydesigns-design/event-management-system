const Order = require('../models/Order');
const TicketType = require('../models/TicketType');
const TicketInstance = require('../models/TicketInstance');
const { generateTicketToken, generateQRImage } = require('../services/qrService');

// Attendee buys ticket(s)
exports.createOrder = async (req, res, next) => {
  try {
    const { eventId, ticketTypeId, quantity } = req.body;
    const ticketType = await TicketType.findById(ticketTypeId);
    if (!ticketType) return res.status(404).json({ message: 'Ticket type not found' });

    const totalAmount = ticketType.price * quantity;
    const order = await Order.create({
      attendee: req.user._id,
      event: eventId,
      totalAmount,
      status: 'paid', // TODO: set to 'pending' once paymentService is wired up
    });

    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const qrToken = generateTicketToken();
      const ticket = await TicketInstance.create({
        order: order._id,
        ticketType: ticketType._id,
        event: eventId,
        attendee: req.user._id,
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
    const tickets = await TicketInstance.find({ attendee: req.user._id }).populate('event ticketType');
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};
