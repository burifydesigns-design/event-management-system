const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');
const { register, login, getMe, updateProfile, requestPasswordReset, completePasswordReset } = require('../controllers/authController');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', completePasswordReset);
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);

module.exports = router;
