const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { salesForEvent } = require('../controllers/reportController');

router.get('/event/:eventId', authMiddleware, role('organizer', 'admin'), salesForEvent);

module.exports = router;
