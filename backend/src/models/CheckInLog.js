const mongoose = require('mongoose');

const checkInLogSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    ticketNumber: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, trim: true },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scannedByRole: { type: String, required: true },
    result: {
      type: String,
      enum: ['valid', 'already_used', 'invalid', 'cancelled', 'wrong_event'],
      required: true,
    },
    scannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

checkInLogSchema.index({ event: 1, scannedAt: -1 });
checkInLogSchema.index({ scannedBy: 1, scannedAt: -1 });
checkInLogSchema.index({ result: 1, scannedAt: -1 });

module.exports = mongoose.model('CheckInLog', checkInLogSchema);
