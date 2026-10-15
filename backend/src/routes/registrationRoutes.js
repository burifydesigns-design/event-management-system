const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateRegistration } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyEvents,
  cancelRegistration,
} = require('../controllers/registrationController');

router.post('/', auth, role('attendee'), validateRegistration, registerForEvent);
router.get('/my-events', auth, getMyEvents);
router.delete('/:id', auth, cancelRegistration);

module.exports = router;
