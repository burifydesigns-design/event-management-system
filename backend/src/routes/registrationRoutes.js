const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRegistration } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyRegistrations,
  getMyEvents,
  getRegistration,
  cancelRegistration,
} = require('../controllers/registrationController');

router.post('/', authMiddleware, validateRegistration, registerForEvent);
router.get('/my', authMiddleware, getMyRegistrations);
router.get('/my-events', authMiddleware, getMyEvents);
router.get('/:id', authMiddleware, getRegistration);
router.delete('/:id', authMiddleware, cancelRegistration);

module.exports = router;
