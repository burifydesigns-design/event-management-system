const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createOrder, myTickets, confirmPayment } = require('../controllers/orderController');

router.post('/', auth, role('attendee'), createOrder);
router.get('/my-tickets', auth, role('attendee'), myTickets);
router.post('/confirm-payment', auth, role('attendee', 'organizer', 'admin'), confirmPayment);

module.exports = router;
