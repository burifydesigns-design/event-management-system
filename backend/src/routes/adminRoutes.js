const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getAllEvents,
  getEventAttendees,
  exportEventAttendees,
  getAnalytics,
} = require('../controllers/adminController');

router.get('/dashboard', authMiddleware, role('admin'), getDashboard);
router.get('/events', authMiddleware, role('admin', 'organizer'), getAllEvents);
router.get('/events/:eventId/attendees', authMiddleware, role('admin'), getEventAttendees);
router.get('/events/:eventId/attendees/export', authMiddleware, role('admin'), exportEventAttendees);
router.get('/analytics', authMiddleware, role('admin'), getAnalytics);

module.exports = router;
