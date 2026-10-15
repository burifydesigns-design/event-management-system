const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');
const { register, login, getMe, updateProfile } = require('../controllers/authController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);

module.exports = router;
