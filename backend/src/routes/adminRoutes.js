const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getEventAttendees,
  exportEventAttendees,
  getAnalytics,
} = require('../controllers/adminController');

router.get('/dashboard', auth, role('admin'), getDashboard);
router.get('/events/:eventId/attendees', auth, role('admin', 'organizer'), getEventAttendees);
router.get('/events/:eventId/attendees/export', auth, role('admin', 'organizer'), exportEventAttendees);
router.get('/analytics', auth, role('admin', 'organizer'), getAnalytics);

module.exports = router;
