const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');
const { register, login, getMe, updateProfile } = require('../controllers/authController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
