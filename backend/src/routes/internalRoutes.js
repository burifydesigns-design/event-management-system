const router = require('express').Router();
const { processEmailOutbox } = require('../controllers/outboxController');

// Invoke from a trusted scheduler (QStash, GitHub Actions or an external cron service).
router.post('/outbox/process', processEmailOutbox);

module.exports = router;
