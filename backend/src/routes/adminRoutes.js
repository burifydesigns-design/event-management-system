const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { requireEventAccess } = require('../middleware/eventAuthMiddleware');
const {
  getDashboard,
  getAllEvents,
  getEventAttendees,
  exportEventAttendees,
  getAnalytics,
} = require('../controllers/adminController');

router.get('/dashboard', auth, role('admin'), getDashboard);
router.get('/events', auth, role('admin'), getAllEvents);
router.get('/events/:eventId/attendees', auth, requireEventAccess(), getEventAttendees);
router.get('/events/:eventId/attendees/export', auth, requireEventAccess(), exportEventAttendees);
router.get('/analytics', auth, role('admin'), getAnalytics);
router.get('/analytics/dashboard', auth, role('admin'), getAnalytics);
router.get('/analytics/organizer', auth, role('organizer', 'admin'), require('../controllers/adminController').getOrganizerAnalytics);

module.exports = router;
