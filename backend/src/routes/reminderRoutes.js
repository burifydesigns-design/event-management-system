const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getEventReminderStats,
  runReminders,
  testReminder,
  getMyReminders,
  updateNotificationPreferences,
} = require('../controllers/reminderController');

router.post('/run', authMiddleware, role('admin', 'organizer'), runReminders);
router.post('/test', authMiddleware, role('admin', 'organizer'), testReminder);
router.get('/my', authMiddleware, getMyReminders);
router.put('/preferences', authMiddleware, updateNotificationPreferences);
router.get('/events/:eventId', authMiddleware, role('admin', 'organizer'), getEventReminderStats);

module.exports = router;
