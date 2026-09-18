const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createEvent,
  listEvents,
  getEvent,
  deleteEvent,
} = require('../controllers/eventController');

router.get('/', listEvents); // public browsing
router.get('/:id', getEvent);
router.post('/', auth, role('organizer', 'admin'), createEvent);
router.delete('/:id', auth, role('organizer', 'admin'), deleteEvent);

module.exports = router;
