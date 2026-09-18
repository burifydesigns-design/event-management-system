const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createOrder, myTickets } = require('../controllers/orderController');

router.post('/', auth, role('attendee'), createOrder);
router.get('/my-tickets', auth, role('attendee'), myTickets);

module.exports = router;
