const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createTicketType,
  listTicketTypesForEvent,
} = require('../controllers/ticketController');

router.get('/event/:eventId', listTicketTypesForEvent);
router.post('/', authMiddleware, role('organizer', 'admin'), createTicketType);

module.exports = router;
