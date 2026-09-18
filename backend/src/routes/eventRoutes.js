const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateEvent } = require('../middleware/validationMiddleware');
const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
} = require('../controllers/eventController');

router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/', auth, role('organizer', 'admin'), validateEvent, createEvent);
router.put('/:id', auth, role('organizer', 'admin'), validateEvent, updateEvent);
router.delete('/:id', auth, role('organizer', 'admin'), deleteEvent);
router.patch('/:id/publish', auth, role('organizer', 'admin'), publishEvent);

module.exports = router;
