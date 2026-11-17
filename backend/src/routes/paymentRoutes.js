const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { initiateMpesaPayment, mpesaCallback } = require('../controllers/paymentController');

router.post('/mpesa/stk-push', auth, role('attendee'), initiateMpesaPayment);
router.post('/mpesa/callback', mpesaCallback);

module.exports = router;
