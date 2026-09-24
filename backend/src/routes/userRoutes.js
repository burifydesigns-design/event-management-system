const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { createStaffUser, listUsers } = require('../controllers/userController');

router.post('/', authMiddleware, role('admin'), createStaffUser); // create coordinator/organizer
router.get('/', authMiddleware, role('admin'), listUsers);

module.exports = router;
