const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createTicketType,
  listTicketTypesForEvent,
} = require('../controllers/ticketController');

router.get('/event/:eventId', listTicketTypesForEvent);
router.post('/', auth, role('organizer', 'admin'), createTicketType);

module.exports = router;
