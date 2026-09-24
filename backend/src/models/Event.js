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
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'draft',
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1, visibility: 1, date: 1 });
eventSchema.index({ category: 1, status: 1, visibility: 1 });
eventSchema.index({ city: 1, status: 1, visibility: 1 });
eventSchema.index({ price: 1, status: 1, visibility: 1 });
eventSchema.index({ title: 'text', description: 'text', category: 'text', city: 'text', location: 'text' });

module.exports = mongoose.model('Event', eventSchema);
