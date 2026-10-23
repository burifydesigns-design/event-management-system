const mongoose = require('mongoose');

const ticketEmailLogSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

ticketEmailLogSchema.index({ registration: 1 });
ticketEmailLogSchema.index({ status: 1, lastAttemptAt: 1 });

module.exports = mongoose.model('TicketEmailLog', ticketEmailLogSchema);
