const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getDashboard,
  getEventAttendees,
  exportEventAttendees,
  getAnalytics,
  getAllEvents,
  getAllUsers,
  updateUserRole,
  deleteUser,
} = require('../controllers/adminController');

router.get('/dashboard', auth, role('admin'), getDashboard);
router.get('/events', auth, role('admin'), getAllEvents);
router.get('/users', auth, role('admin'), getAllUsers);
router.put('/users/:id', auth, role('admin'), updateUserRole);
router.delete('/users/:id', auth, role('admin'), deleteUser);
router.get('/events/:eventId/attendees', auth, role('admin'), getEventAttendees);
router.get('/events/:eventId/attendees/export', auth, role('admin'), exportEventAttendees);
router.get('/analytics', auth, role('admin'), getAnalytics);

module.exports = router;
