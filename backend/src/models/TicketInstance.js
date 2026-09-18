const mongoose = require('mongoose');

const ticketInstanceSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    ticketType: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    qrToken: { type: String, required: true, unique: true }, // encoded into the QR code
    status: { type: String, enum: ['valid', 'used', 'void'], default: 'valid' },
    scannedAt: Date,
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TicketInstance', ticketInstanceSchema);
