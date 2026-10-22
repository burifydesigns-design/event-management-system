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
  getUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  deleteEvent,
} = require('../controllers/adminController');

router.get('/dashboard', auth, role('admin'), getDashboard);
router.get('/events', auth, role('admin'), getAllEvents);
router.get('/events/:eventId/attendees', auth, requireEventAccess(), getEventAttendees);
router.get('/events/:eventId/attendees/export', auth, requireEventAccess(), exportEventAttendees);
router.delete('/events/:id', auth, role('admin'), deleteEvent);
router.get('/analytics', auth, role('admin'), getAnalytics);
router.get('/analytics/dashboard', auth, role('admin'), getAnalytics);
router.get('/analytics/organizer', auth, role('organizer', 'admin'), require('../controllers/adminController').getOrganizerAnalytics);
router.get('/users', auth, role('admin'), require('../controllers/userController').listUsers);
router.get('/users/:id', auth, role('admin'), getUser);
router.patch('/users/:id/role', auth, role('admin'), updateUserRole);
router.patch('/users/:id/status', auth, role('admin'), updateUserStatus);
router.delete('/users/:id', auth, role('admin'), deleteUser);

module.exports = router;
