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
router.get('/events/:eventId/attendees', auth, role('admin'), getEventAttendees);
router.get('/events/:eventId/attendees/export', auth, role('admin'), exportEventAttendees);
router.get('/analytics', auth, role('admin'), getAnalytics);

module.exports = router;
