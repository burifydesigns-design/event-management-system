const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createOrder, myTickets } = require('../controllers/orderController');

router.post('/', authMiddleware, role('attendee'), createOrder);
router.get('/my-tickets', authMiddleware, role('attendee'), myTickets);

module.exports = router;
