const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
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
router.post('/', auth, validateEvent, createEvent);
router.put('/:id', auth, updateEvent);
router.delete('/:id', auth, deleteEvent);
router.patch('/:id/publish', auth, publishEvent);

module.exports = router;
