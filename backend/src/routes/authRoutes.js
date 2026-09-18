const router = require('express').Router();
const { signup, login } = require('../controllers/authController');

router.post('/signup', signup); // attendee self-signup only
router.post('/login', login);

module.exports = router;
