const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  getTicket,
  getTicketQR,
  validateTicket,
  checkInTicket,
  issueTicket,
  resendTicketEmail,
  myTickets,
} = require('../controllers/ticketController');

router.get('/:id', auth, validateObjectIdParam('id'), getTicket);
router.get('/:id/qr', auth, validateObjectIdParam('id'), getTicketQR);
router.post('/validate', auth, role('organizer', 'admin', 'coordinator'), validateTicket);
router.post('/check-in', auth, role('organizer', 'admin', 'coordinator'), checkInTicket);
router.post('/issue', auth, role('organizer', 'admin'), issueTicket);
router.post('/:id/resend-email', auth, validateObjectIdParam('id'), resendTicketEmail);
router.get('/my', auth, myTickets);

module.exports = router;
