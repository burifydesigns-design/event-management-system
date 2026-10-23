const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { scanTicket, scanEvents, scanHistory } = require('../controllers/scanController');

router.post('/', auth, role('coordinator', 'organizer', 'admin'), scanTicket);
router.get('/events', auth, role('coordinator', 'organizer', 'admin'), scanEvents);
router.get('/history', auth, role('coordinator', 'organizer', 'admin'), scanHistory);

module.exports = router;
