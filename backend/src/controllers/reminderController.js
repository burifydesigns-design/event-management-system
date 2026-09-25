const Reminder = require('../models/Reminder');
const Registration = require('../models/Registration');
const { getReminderStats } = require('../services/reminderService');

exports.getEventReminderStats = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const stats = await getReminderStats(eventId);
    const registrations = await Registration.find({ event: eventId, status: 'confirmed' }).countDocuments();

    res.json({
      eventId,
      totalRegistrations: registrations,
      reminders: stats || [],
    });
  } catch (err) {
    next(err);
  }
};

exports.runReminders = async (req, res, next) => {
  try {
    const results = await require('../services/reminderService').runScheduler();
    res.json({ message: 'Reminder scheduler executed', results });
  } catch (err) {
    next(err);
  }
};

exports.testReminder = async (req, res, next) => {
  try {
    const { registrationId, reminderType } = req.body;
    if (!registrationId) {
      return res.status(400).json({ message: 'Registration ID is required' });
    }
    if (!['24h', '1h'].includes(reminderType)) {
      return res.status(400).json({ message: 'Invalid reminder type. Use 24h or 1h.' });
    }

    const registration = await Registration.findById(registrationId)
      .populate('user', 'name email')
      .populate('event');

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const event = registration.event;
    const user = registration.user;

    if (registration.status !== 'confirmed') {
      return res.status(400).json({ message: 'Registration is not confirmed' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    let result;
    if (reminderType === '24h') {
      const { sendReminder24hEmail } = require('../services/emailService');
      result = await sendReminder24hEmail(user, event, registration, baseUrl);
    } else {
      const { sendReminder1hEmail } = require('../services/emailService');
      result = await sendReminder1hEmail(user, event, registration, baseUrl);
    }

    res.json({
      success: result.success,
      messageId: result.messageId || null,
      error: result.reason || null,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyReminders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const reminders = await Reminder.find({ user: userId })
      .populate('event', 'title date time location city')
      .populate('registration', 'ticketNumber status')
      .sort({ createdAt: -1 });

    res.json({ count: reminders.length, reminders });
  } catch (err) {
    next(err);
  }
};

exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const userId = req.user.userId;
    const { reminder24h, reminder1h } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (typeof reminder24h === 'boolean') {
      user.notificationPreferences = user.notificationPreferences || {};
      user.notificationPreferences.reminder24h = reminder24h;
    }
    if (typeof reminder1h === 'boolean') {
      user.notificationPreferences = user.notificationPreferences || {};
      user.notificationPreferences.reminder1h = reminder1h;
    }

    await user.save();

    res.json({
      message: 'Notification preferences updated',
      notificationPreferences: user.notificationPreferences,
    });
  } catch (err) {
    next(err);
  }
};
