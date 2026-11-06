const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { scanTicket } = require('../controllers/scanController');

router.post('/', auth, role('coordinator', 'organizer', 'admin'), scanTicket);

module.exports = router;
