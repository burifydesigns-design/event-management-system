const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateRegistration } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyRegistrations,
  getMyEvents,
  cancelRegistration,
  getRegistration,
  getTicket,
} = require('../controllers/registrationController');

router.post('/', auth, role('attendee'), validateRegistration, registerForEvent);
router.get('/my', auth, getMyRegistrations);
router.get('/my-events', auth, getMyEvents);
router.get('/:id', auth, getRegistration);
router.get('/:registrationId/ticket', auth, getTicket);
router.delete('/:id', auth, cancelRegistration);

module.exports = router;