const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createStaffUser, listUsers } = require('../controllers/userController');

router.post('/', auth, role('admin'), createStaffUser); // create coordinator/organizer
router.get('/', auth, role('admin'), listUsers);

module.exports = router;
