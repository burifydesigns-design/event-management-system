const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { salesForEvent } = require('../controllers/reportController');

router.get('/event/:eventId', auth, role('organizer', 'admin'), salesForEvent);

module.exports = router;
