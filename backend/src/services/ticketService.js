const crypto = require('crypto');
const Registration = require('../models/Registration');
const TicketInstance = require('../models/TicketInstance');
const TicketEmailLog = require('../models/TicketEmailLog');
const CheckInLog = require('../models/CheckInLog');
const { generateQRImage } = require('./qrService');
const { sendTicketEmail } = require('./emailService');

/**
 * Generate a cryptographically secure, unpredictable ticket credential.
 * Never encode attendee PII in this value.
 */
function generateTicketToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Issue a ticket record for an attendee to an event.
 * Idempotent: if a ticket (registration) already exists for the user+event,
 * returns the existing record instead of creating a duplicate.
 *
 * Paid tickets require a confirmed (paid) order before issuance.
 */
async function issueTicket({ userId, eventId, ticketTypeId, orderId }) {
  const existing = await Registration.findOne({ user: userId, event: eventId });
  if (existing) {
    return { ticket: existing, created: false };
  }

  // For paid orders, verify payment is confirmed before issuing.
  if (orderId) {
    const Order = require('../models/Order');
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'paid') {
      throw new Error('Payment not confirmed');
    }
    if (String(order.attendee) !== String(userId)) {
      throw new Error('Order does not belong to this attendee');
    }
    if (String(order.event) !== String(eventId)) {
      throw new Error('Order does not belong to this event');
    }
  }

  const qrToken = generateTicketToken();
  const ticketNumber = 'EVT-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const registration = await Registration.create({
    user: userId,
    event: eventId,
    order: orderId || null,
    ticketType: ticketTypeId || null,
    ticketNumber,
    qrToken,
    status: 'confirmed',
  });

  // Link TicketInstance to Registration if one exists for this order.
  if (orderId) {
    await TicketInstance.updateMany(
      { order: orderId, attendee: userId },
      { $set: { registration: registration._id, status: 'issued' } }
    );
  }

  // Queue the ticket email (non-blocking). Delivery status tracked in TicketEmailLog.
  const emailLog = await TicketEmailLog.create({
    registration: registration._id,
    status: 'pending',
    attempts: 0,
  });

  sendTicketEmail(registration, emailLog._id).catch((err) => {
    console.error('Failed to queue ticket email:', err.message);
  });

  return { ticket: registration, created: true, emailLogId: emailLog._id };
}

/**
 * Atomically check in a ticket. Uses findOneAndUpdate with a conditional
 * filter so two concurrent scanners cannot admit the same ticket twice.
 * Returns { result, registration } where result is one of:
 * 'valid', 'already_used', 'invalid', 'cancelled', 'wrong_event'.
 */
async function atomicCheckIn({ qrToken, eventId, staffUserId, staffRole }) {
  if (!qrToken || !eventId) {
    return { result: 'invalid', registration: null };
  }

  const registration = await Registration.findOne({ qrToken }).populate('event');
  if (!registration) {
    return { result: 'invalid', registration: null };
  }

  const event = registration.event;
  if (!event) {
    return { result: 'invalid', registration: null };
  }

  // Wrong event: ticket belongs to a different event.
  if (String(event._id) !== String(eventId)) {
    await logCheckIn({
      registration: registration._id,
      event: event._id,
      ticketNumber: registration.ticketNumber,
      qrToken,
      scannedBy: staffUserId,
      scannedByRole: staffRole,
      result: 'wrong_event',
    });
    return { result: 'wrong_event', registration };
  }

  // Cancelled / refunded ticket.
  if (registration.status === 'cancelled' || registration.status === 'refunded') {
    await logCheckIn({
      registration: registration._id,
      event: event._id,
      ticketNumber: registration.ticketNumber,
      qrToken,
      scannedBy: staffUserId,
      scannedByRole: staffRole,
      result: 'cancelled',
    });
    return { result: 'cancelled', registration };
  }

  // Not confirmed (should not happen for issued tickets, but guard anyway).
  if (registration.status !== 'confirmed') {
    await logCheckIn({
      registration: registration._id,
      event: event._id,
      ticketNumber: registration.ticketNumber,
      qrToken,
      scannedBy: staffUserId,
      scannedByRole: staffRole,
      result: 'invalid',
    });
    return { result: 'invalid', registration };
  }

  // Atomic single-document update: only succeeds if not already checked in.
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, status: 'confirmed', checkedIn: false },
    {
      $set: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: staffUserId,
      },
    },
    { new: true }
  );

  if (!updated) {
    // Another scanner already checked this ticket in.
    await logCheckIn({
      registration: registration._id,
      event: event._id,
      ticketNumber: registration.ticketNumber,
      qrToken,
      scannedBy: staffUserId,
      scannedByRole: staffRole,
      result: 'already_used',
    });
    return { result: 'already_used', registration };
  }

  await logCheckIn({
    registration: registration._id,
    event: event._id,
    ticketNumber: registration.ticketNumber,
    qrToken,
    scannedBy: staffUserId,
    scannedByRole: staffRole,
    result: 'valid',
  });

  return { result: 'valid', registration: updated };
}

async function logCheckIn({ registration, event, ticketNumber, qrToken, scannedBy, scannedByRole, result }) {
  try {
    await CheckInLog.create({
      registration,
      event,
      ticketNumber,
      qrToken,
      scannedBy,
      scannedByRole,
      result,
    });
  } catch (err) {
    // Audit log failure must not fail the check-in response.
    console.error('Failed to write check-in audit log:', err.message);
  }
}

module.exports = {
  generateTicketToken,
  issueTicket,
  atomicCheckIn,
};
