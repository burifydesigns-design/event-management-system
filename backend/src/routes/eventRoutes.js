const router = require('express').Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');
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
router.get('/:id', optionalAuthMiddleware, getEvent);
router.post('/', authMiddleware, validateEvent, createEvent);
router.put('/:id', authMiddleware, updateEvent);
router.delete('/:id', authMiddleware, deleteEvent);
router.patch('/:id/publish', authMiddleware, publishEvent);

module.exports = router;
