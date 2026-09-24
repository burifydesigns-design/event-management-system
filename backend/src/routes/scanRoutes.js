const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { scanTicket } = require('../controllers/scanController');

router.post('/', authMiddleware, role('coordinator', 'organizer', 'admin'), scanTicket);

module.exports = router;
