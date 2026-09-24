const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createTicketType,
  listTicketTypesForEvent,
  getTicket,
} = require('../controllers/ticketController');

router.get('/event/:eventId', listTicketTypesForEvent);
router.post('/', authMiddleware, role('organizer', 'admin'), createTicketType);
router.get('/:ticketId', authMiddleware, getTicket);

module.exports = router;
