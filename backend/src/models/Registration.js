const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'checked-in'],
      default: 'confirmed',
    },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true, autoIndex: true }
);

module.exports = mongoose.model('Registration', registrationSchema);
