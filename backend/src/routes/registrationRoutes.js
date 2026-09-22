const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { validateRegistration } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyRegistrations,
  getMyEvents,
  cancelRegistration,
} = require('../controllers/registrationController');

router.post('/', auth, validateRegistration, registerForEvent);
router.get('/my', auth, getMyRegistrations);
router.get('/my-events', auth, getMyEvents);
router.delete('/:id', auth, cancelRegistration);

module.exports = router;
