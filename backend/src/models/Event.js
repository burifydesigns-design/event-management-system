const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    location: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    image: { type: String, default: "" },
    // Per-event poster/ticket colors. colorA = main halftone color, colorB = halftone dot color.
    // Organizer picks from a fixed preset when creating; defaults fall back to the first preset.
    colorA: { type: String, default: "#c42a55" },
    colorB: { type: String, default: "#ffb703" },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'draft',
    },
    registrationDeadline: { type: Date },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ category: 1, date: 1 });
eventSchema.index({ organizer: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
