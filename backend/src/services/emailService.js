const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendTransactionalEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured');
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Email provider returned HTTP ${response.status}`);
  return result;
}

async function sendOutboxMessage(message) {
  if (message.event_type !== 'ticket_purchase_confirmation') {
    throw new Error(`Unsupported email event type: ${message.event_type}`);
  }
  const p = message.payload || {};
  const title = String(p.eventTitle || 'your event');
  const attendee = String(p.attendeeName || 'there');
  const orderId = String(p.orderId || '');
  const date = p.eventDate ? new Date(p.eventDate).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }) : 'See your ticket details';
  const location = [p.eventLocation, p.eventCity].filter(Boolean).join(', ');
  const safe = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const html = `<h2>Payment confirmed</h2><p>Hello ${safe(attendee)},</p><p>Your payment for <strong>${safe(title)}</strong> has been confirmed.</p><ul><li>Date: ${safe(date)}</li><li>Location: ${safe(location || 'See event details')}</li><li>Tickets: ${Number(p.ticketCount) || 0}</li><li>Order reference: ${safe(orderId)}</li></ul><p>Your issued tickets and QR codes are available in your account under My Tickets.</p>`;
  const text = `Payment confirmed for ${title}. Tickets: ${Number(p.ticketCount) || 0}. Order: ${orderId}. View your QR tickets in your account under My Tickets.`;
  return sendTransactionalEmail({
    to: message.recipient,
    subject: `Payment confirmed: ${title}`,
    html,
    text,
    idempotencyKey: message.id,
  });
}

module.exports = { sendTransactionalEmail, sendOutboxMessage };
