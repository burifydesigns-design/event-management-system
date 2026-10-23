const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  getOverview,
  getEventAnalytics,
  getPlatformAnalytics,
  getOrganizerAnalytics,
  getCoordinatorPerformance,
  exportRegistrationsCSV,
} = require('../controllers/analyticsController');

router.get('/overview', auth, role('admin'), getOverview);
router.get('/events/:id', auth, validateObjectIdParam('id'), getEventAnalytics);
router.get('/platform', auth, role('admin'), getPlatformAnalytics);
router.get('/organizer', auth, role('organizer', 'admin'), getOrganizerAnalytics);
router.get('/coordinator-performance', auth, role('admin', 'organizer', 'coordinator'), getCoordinatorPerformance);
router.get('/export/csv', auth, role('admin', 'organizer', 'coordinator'), exportRegistrationsCSV);

module.exports = router;
