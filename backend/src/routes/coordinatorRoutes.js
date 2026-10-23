const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { validateObjectIdParam } = require('../middleware/validationMiddleware');
const {
  createAssignment,
  listAssignments,
  deleteAssignment,
  myEvents,
  listCoordinators,
} = require('../controllers/coordinatorController');

router.post('/assignments', auth, role('admin', 'organizer'), createAssignment);
router.get('/assignments', auth, role('admin', 'organizer', 'coordinator'), listAssignments);
router.delete('/assignments/:id', auth, role('admin', 'organizer'), validateObjectIdParam('id'), deleteAssignment);
router.get('/me/events', auth, role('coordinator'), myEvents);
router.get('/coordinators', auth, role('admin', 'organizer'), listCoordinators);

module.exports = router;
