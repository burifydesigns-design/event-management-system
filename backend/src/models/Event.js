const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    venue: String,
    startsAt: { type: Date, required: true },
    endsAt: Date,
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coordinators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
