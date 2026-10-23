const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateEvent, validateEventUpdate, validatePaginationQuery, validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
} = require('../controllers/eventController');

router.get('/', validatePaginationQuery, listEvents);
router.get('/:id', validateObjectIdParam('id'), getEvent);
router.post('/', auth, role('organizer', 'admin'), validateEvent, createEvent);
router.put('/:id', auth, validateObjectIdParam('id'), validateEventUpdate, updateEvent);
router.delete('/:id', auth, validateObjectIdParam('id'), deleteEvent);
router.patch('/:id/publish', auth, validateObjectIdParam('id'), publishEvent);

module.exports = router;
