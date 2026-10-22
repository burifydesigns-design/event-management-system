const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateRegistration, validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyEvents,
  cancelRegistration,
  getRegistration,
} = require('../controllers/registrationController');

router.post('/', auth, role('attendee', 'organizer', 'admin'), validateRegistration, registerForEvent);
router.get('/my-events', auth, getMyEvents);
router.get('/:id', auth, validateObjectIdParam('id'), getRegistration);
router.delete('/:id', auth, validateObjectIdParam('id'), cancelRegistration);

module.exports = router;
