const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const TicketInstance = require('../models/TicketInstance');
const { sendReminder24hEmail, sendReminder1hEmail } = require('../services/emailService');

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

function getEventStartDateTime(event) {
  if (!event || !event.date) return null;
  const dateStr = event.date.toISOString().split('T')[0];
  const timeStr = event.time || '00:00';
  return new Date(`${dateStr}T${timeStr}`);
}

function isReminderTypeEnabled(user, reminderType) {
  if (!user || !user.notificationPreferences) return true;
  if (reminderType === '24h') return user.notificationPreferences.reminder24h !== false;
  if (reminderType === '1h') return user.notificationPreferences.reminder1h !== false;
  return true;
}

async function createRemindersForRegistration(registration, event) {
  if (!registration || !event) return [];

  if (!registration._id || !event._id || !registration.user) return [];

  const eventStart = getEventStartDateTime(event);
  if (!eventStart) return [];

  const now = new Date();
  if (eventStart <= now) return [];

  const reminders = [];
  const reminderTypes = [
    { type: '24h', scheduledFor: new Date(eventStart.getTime() - 24 * 60 * 60 * 1000) },
    { type: '1h', scheduledFor: new Date(eventStart.getTime() - 1 * 60 * 60 * 1000) },
  ];

  for (const rt of reminderTypes) {
    if (rt.scheduledFor <= now) continue;

    try {
      const reminder = await Reminder.create({
        registration: registration._id,
        user: registration.user,
        event: event._id,
        reminderType: rt.type,
        scheduledFor: rt.scheduledFor,
        ticketNumber: registration.ticketNumber,
      });
      reminders.push(reminder);
    } catch (err) {
      if (err.code === 11000) {
        continue;
      }
      console.error(`Failed to create ${rt.type} reminder for registration ${registration._id}:`, err.message);
    }
  }

  return reminders;
}

async function processReminder(reminder) {
  if (reminder.status === 'sent') return { status: 'already_sent' };
  if (reminder.status === 'skipped') return { status: 'already_skipped' };
  if (reminder.status === 'failed' && reminder.attempts >= MAX_ATTEMPTS) return { status: 'max_attempts_reached' };

  const [registration, event, user] = await Promise.all([
    Registration.findById(reminder.registration),
    Event.findById(reminder.event),
    User.findById(reminder.user),
  ]);

  if (!registration || registration.status !== 'confirmed') {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Registration not confirmed' });
    return { status: 'skipped' };
  }

  if (!event) {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Event not found' });
    return { status: 'skipped' };
  }

  if (event.status === 'cancelled') {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Event cancelled' });
    return { status: 'skipped' };
  }

  if (event.status !== 'published') {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Event not published' });
    return { status: 'skipped' };
  }

  const eventStart = getEventStartDateTime(event);
  if (!eventStart || eventStart <= new Date()) {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Event already started' });
    return { status: 'skipped' };
  }

  if (!user) {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'User not found' });
    return { status: 'skipped' };
  }

  if (!isReminderTypeEnabled(user, reminder.reminderType)) {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'Reminder disabled by user preference' });
    return { status: 'skipped' };
  }

  const ticket = await TicketInstance.findOne({
    event: event._id,
    attendee: user._id,
  }).sort({ createdAt: -1 });

  if (!ticket || ticket.status === 'void') {
    await Reminder.findByIdAndUpdate(reminder._id, { status: 'skipped', lastError: 'No valid ticket' });
    return { status: 'skipped' };
  }

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  let result;
  if (reminder.reminderType === '24h') {
    result = await sendReminder24hEmail(user, event, registration, baseUrl);
  } else if (reminder.reminderType === '1h') {
    result = await sendReminder1hEmail(user, event, registration, baseUrl);
  }

  if (result && result.success) {
    await Reminder.findByIdAndUpdate(reminder._id, {
      status: 'sent',
      sentAt: new Date(),
      attempts: reminder.attempts + 1,
      lastError: null,
    });
    return { status: 'sent' };
  } else {
    const newAttempts = reminder.attempts + 1;
    const update = {
      attempts: newAttempts,
      lastError: result ? result.reason : 'Unknown error',
    };
    if (newAttempts >= MAX_ATTEMPTS) {
      update.status = 'failed';
    }
    await Reminder.findByIdAndUpdate(reminder._id, update);
    return { status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'retry' };
  }
}

async function runScheduler() {
  const now = new Date();
  const pendingReminders = await Reminder.find({
    scheduledFor: { $lte: now },
    status: { $in: ['pending', 'failed'] },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ scheduledFor: 1 })
    .limit(BATCH_SIZE);

  let results = { sent: 0, failed: 0, skipped: 0, retry: 0, already_sent: 0, max_attempts_reached: 0 };

  for (const reminder of pendingReminders) {
    try {
      const result = await processReminder(reminder);
      results[result.status] = (results[result.status] || 0) + 1;
    } catch (err) {
      console.error(`Unexpected error processing reminder ${reminder._id}:`, err.message);
      results.failed++;
      await Reminder.findByIdAndUpdate(reminder._id, {
        attempts: reminder.attempts + 1,
        lastError: err.message,
        ...(reminder.attempts + 1 >= MAX_ATTEMPTS ? { status: 'failed' } : {}),
      });
    }
  }

  return results;
}

async function getReminderStats(eventId) {
  if (!eventId) return null;

  const stats = await Reminder.aggregate([
    { $match: { event: new (require('mongoose').Schema.Types.ObjectId)(eventId) } },
    {
      $group: {
        _id: '$reminderType',
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
      },
    },
  ]);

  return stats;
}

let schedulerTask = null;

function startScheduler() {
  if (schedulerTask) {
    console.log('Reminder scheduler already running');
    return;
  }

  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      const results = await runScheduler();
      if (results.sent + results.failed + results.skipped > 0) {
        console.log('Reminder scheduler run:', results);
      }
    } catch (err) {
      console.error('Reminder scheduler error:', err.message);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('Reminder scheduler started (runs every minute)');
}

function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('Reminder scheduler stopped');
  }
}

module.exports = {
  createRemindersForRegistration,
  processReminder,
  runScheduler,
  startScheduler,
  stopScheduler,
  getReminderStats,
  getEventStartDateTime,
  isReminderTypeEnabled,
  MAX_ATTEMPTS,
  BATCH_SIZE,
};
