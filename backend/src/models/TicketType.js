const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true }, // e.g. Regular, VIP
    price: { type: Number, required: true },
    quantityAvailable: { type: Number, required: true },
    quantitySold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TicketType', ticketTypeSchema);
