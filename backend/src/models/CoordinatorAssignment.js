const mongoose = require('mongoose');

const coordinatorAssignmentSchema = new mongoose.Schema(
  {
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

coordinatorAssignmentSchema.index({ coordinator: 1, event: 1 }, { unique: true });
coordinatorAssignmentSchema.index({ event: 1 });

module.exports = mongoose.model('CoordinatorAssignment', coordinatorAssignmentSchema);
