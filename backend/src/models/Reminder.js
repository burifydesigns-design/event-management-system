const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    reminderType: { type: String, enum: ['24h', '1h'], required: true },
    scheduledFor: { type: Date, required: true },
    sentAt: { type: Date },
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    ticketNumber: { type: String },
  },
  { timestamps: true }
);

reminderSchema.index({ registration: 1, reminderType: 1 }, { unique: true });
reminderSchema.index({ event: 1, status: 1 });
reminderSchema.index({ user: 1, status: 1 });
reminderSchema.index({ scheduledFor: 1, status: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
