const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  createTicketType,
  listTicketTypesForEvent,
  getTicket,
  getTicketQR,
  validateTicket,
  checkInTicket,
} = require('../controllers/ticketController');

router.get('/event/:eventId', listTicketTypesForEvent);
router.post('/', auth, role('organizer', 'admin'), createTicketType);
router.get('/:id', auth, validateObjectIdParam('id'), getTicket);
router.get('/:id/qr', auth, validateObjectIdParam('id'), getTicketQR);
router.post('/validate', auth, role('organizer', 'admin'), validateTicket);
router.post('/check-in', auth, role('organizer', 'admin'), checkInTicket);

module.exports = router;
