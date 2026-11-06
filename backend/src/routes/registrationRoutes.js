const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateRegistration, validateObjectIdParam, validatePaginationQuery } = require('../middleware/validationMiddleware');
const {
  registerForEvent,
  getMyEvents,
  cancelRegistration,
  getRegistration,
} = require('../controllers/registrationController');

function validateMyEventsQuery(req, res, next) {
  if (req.query.tab !== undefined) {
    const allowed = ['upcoming', 'past', 'cancelled'];
    if (!allowed.includes(req.query.tab)) {
      return res.status(400).json({ message: 'Invalid tab' });
    }
  }
  next();
}

router.post('/', auth, role('attendee', 'organizer', 'admin'), validateRegistration, registerForEvent);
router.get('/my-events', auth, validatePaginationQuery, validateMyEventsQuery, getMyEvents);
router.get('/:id', auth, validateObjectIdParam('id'), getRegistration);
router.delete('/:id', auth, validateObjectIdParam('id'), cancelRegistration);

module.exports = router;
