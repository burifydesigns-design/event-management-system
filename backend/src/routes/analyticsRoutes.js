const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');
const { getOverview, getEventAnalytics } = require('../controllers/analyticsController');

router.get('/overview', auth, role('admin'), getOverview);
router.get('/events/:id', auth, validateObjectIdParam('id'), getEventAnalytics);

module.exports = router;
