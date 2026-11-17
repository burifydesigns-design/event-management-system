const crypto = require('crypto');
const { getSupabase } = require('../config/db');
const { sendOutboxMessage } = require('../services/emailService');
const db = () => getSupabase();

function isAuthorized(req) {
  const expected = process.env.OUTBOX_WORKER_TOKEN;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.processEmailOutbox = async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ message: 'Unauthorized' });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ message: 'Transactional email provider is not configured' });
  }

  try {
    const { data: messages, error } = await db().rpc('claim_email_outbox', { p_batch_size: 25 });
    if (error) throw error;
    const summary = { claimed: (messages || []).length, sent: 0, failed: 0 };

    for (const message of messages || []) {
      try {
        await sendOutboxMessage(message);
        const { error: updateError } = await db().from('email_outbox').update({
          status: 'sent', sent_at: new Date().toISOString(), locked_at: null, last_error: null,
        }).eq('id', message.id);
        if (updateError) throw updateError;
        summary.sent += 1;
      } catch (sendError) {
        const attempts = Number(message.attempts) || 1;
        const delaySeconds = Math.min(6 * 60 * 60, 60 * (2 ** Math.min(attempts, 8)));
        const { error: updateError } = await db().from('email_outbox').update({
          status: 'failed',
          locked_at: null,
          available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          last_error: String(sendError.message || 'Email delivery failed').slice(0, 1000),
        }).eq('id', message.id);
        if (updateError) console.error('Could not reschedule email outbox row:', updateError.message);
        summary.failed += 1;
      }
    }

    return res.json(summary);
  } catch (error) {
    console.error('Email outbox processing failed:', error.message);
    return res.status(503).json({ message: 'Email outbox processing is temporarily unavailable' });
  }
};
