const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createTicketType, listTicketTypesForEvent } = require('../controllers/ticketController');
const { myTickets } = require('../controllers/orderController');

router.get('/event/:eventId', listTicketTypesForEvent);
router.get('/my', auth, role('attendee'), myTickets);
router.post('/', auth, role('organizer', 'admin'), createTicketType);

module.exports = router;
