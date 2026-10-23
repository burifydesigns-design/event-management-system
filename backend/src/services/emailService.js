const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const Registration = require('../models/Registration');
const TicketEmailLog = require('../models/TicketEmailLog');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com';
const MAX_EMAIL_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Generate a QR code data URL for a ticket token.
 */
async function generateTicketQR(token) {
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/**
 * Build a professionally designed HTML ticket email.
 */
function buildTicketEmailHtml({ event, attendee, ticketReference, qrDataUrl, supportContact }) {
  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Ticket - ${event.title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; color: #1e293b; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%); padding: 32px 24px; text-align: center; color: white; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
  .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
  .body { padding: 24px; }
  .ticket-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; background: #f8fafc; }
  .ticket-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
  .ticket-row:last-child { border-bottom: none; }
  .label { color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .value { font-weight: 600; color: #1e293b; }
  .ticket-ref { font-family: 'Courier New', monospace; background: #1e293b; color: #4ade80; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
  .qr-section { text-align: center; margin: 24px 0; }
  .qr-section img { width: 180px; height: 180px; background: white; padding: 8px; border-radius: 8px; display: inline-block; }
  .qr-fallback { margin-top: 8px; font-size: 13px; color: #64748b; word-break: break-all; }
  .instructions { background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 24px; }
  .instructions h3 { margin-top: 0; color: #1e293b; font-size: 16px; }
  .instructions ol { margin: 8px 0 0; padding-left: 20px; color: #475569; }
  .instructions li { margin-bottom: 6px; }
  .footer { padding: 20px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  .support { color: #4f46e5; text-decoration: none; font-weight: 600; }
  .badge { display: inline-block; background: #4f46e5; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-left: 8px; }
  .status-checkedin { color: #10b981; font-weight: 700; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${event.title}</h1>
      <p>${event.location}, ${event.city}</p>
    </div>
    <div class="body">
      <p>Hello <strong>${attendee.name}</strong>,</p>
      <p>Your ticket is confirmed. Present the QR code below at the venue for check-in.</p>
      <div class="ticket-card">
        <div class="ticket-row"><span class="label">Event</span><span class="value">${event.title}</span></div>
        <div class="ticket-row"><span class="label">Date & Time</span><span class="value">${eventDate} • ${event.time || 'TBD'}</span></div>
        <div class="ticket-row"><span class="label">Venue</span><span class="value">${event.location}, ${event.city}</span></div>
        <div class="ticket-row"><span class="label">Attendee</span><span class="value">${attendee.name}</span></div>
        <div class="ticket-row"><span class="label">Ticket Type</span><span class="value">${attendee.ticketType || 'General Admission'}</span></div>
        <div class="ticket-row"><span class="label">Ticket Reference</span><span class="value ticket-ref">${ticketReference}</span></div>
      </div>
      <div class="qr-section">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Ticket QR code" />` : '<div style="width:180px;height:180px;border:2px dashed #cbd5e1;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">QR code unavailable</div>'}
        <div class="qr-fallback">Ticket Reference: ${ticketReference}</div>
      </div>
      <div class="instructions">
        <h3>Check-in Instructions</h3>
        <ol>
          <li>Arrive at the venue at least 30 minutes before the event start time.</li>
          <li>Present this ticket (on your phone or printed) at the check-in desk.</li>
          <li>A staff member will scan your QR code to confirm your admission.</li>
          <li>Each ticket can only be checked in once. Keep your ticket reference safe.</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:${supportContact || FROM}" class="support">${supportContact || FROM}</a></p>
      <p>Ticket Reference: <strong>${ticketReference}</strong></p>
      <p>&copy; 2026 Event Management Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send a ticket email with QR code. Tracks delivery status in TicketEmailLog
 * with retry handling. Never throws to the caller; failures are logged and
 * retried up to MAX_EMAIL_ATTEMPTS times.
 */
async function sendTicketEmail(registration, emailLogId) {
  let emailLog;
  try {
    emailLog = await TicketEmailLog.findById(emailLogId);
    if (!emailLog) {
      console.error('Ticket email log not found:', emailLogId);
      return;
    }
    if (emailLog.status === 'sent') {
      return; // Already delivered
    }
  } catch (err) {
    console.error('Failed to load email log:', err.message);
    return;
  }

  const send = async () => {
    emailLog.attempts += 1;
    emailLog.lastAttemptAt = new Date();

    try {
      const event = registration.event || await Registration.findById(registration._id).populate('event');
      const eventDoc = registration.event || event.event;

      const attendee = {
        name: registration.user ? registration.user.name : 'Attendee',
        ticketType: registration.ticketType ? null : 'General Admission',
      };

      let qrDataUrl = null;
      try {
        qrDataUrl = await generateTicketQR(registration.qrToken);
      } catch (qrErr) {
        console.error('Failed to generate QR image:', qrErr.message);
      }

      const html = buildTicketEmailHtml({
        event: {
          title: eventDoc.title,
          date: eventDoc.date,
          time: eventDoc.time,
          location: eventDoc.location,
          city: eventDoc.city,
        },
        attendee,
        ticketReference: registration.ticketNumber,
        qrDataUrl,
        supportContact: process.env.SUPPORT_EMAIL || FROM,
      });

      await transporter.sendMail({
        from: FROM,
        to: registration.user ? registration.user.email : null,
        subject: `Your Ticket: ${eventDoc.title}`,
        html,
      });

      emailLog.status = 'sent';
      emailLog.sentAt = new Date();
      emailLog.error = null;
      await emailLog.save();

      await Registration.findByIdAndUpdate(registration._id, {
        $set: { emailSent: true, emailSentAt: new Date() },
      });

      return { success: true };
    } catch (err) {
      emailLog.error = err.message;
      if (emailLog.attempts < MAX_EMAIL_ATTEMPTS) {
        await emailLog.save();
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return send();
      }
      emailLog.status = 'failed';
      await emailLog.save();
      console.error('Ticket email failed after retries:', err.message);
      return { success: false, error: err.message };
    }
  };

  return send();
}

/**
 * Resend a ticket email. Creates a new delivery attempt if previous failed.
 */
async function resendTicketEmail(registrationId) {
  const registration = await Registration.findById(registrationId).populate('user event');
  if (!registration) {
    throw new Error('Registration not found');
  }

  const existingLog = await TicketEmailLog.findOne({ registration: registrationId }).sort({ createdAt: -1 });

  const emailLog = await TicketEmailLog.create({
    registration: registrationId,
    status: 'pending',
    attempts: 0,
  });

  await sendTicketEmail(registration, emailLog._id);
  return emailLog;
}

/**
 * Send registration confirmation email (existing flow, kept for backward compat).
 */
async function sendRegistrationEmail(to, eventDetails, ticketNumber) {
  const html = `
    <h2>Event Registration Confirmed</h2>
    <p>You have successfully registered for <strong>${eventDetails.name}</strong></p>
    <ul>
      <li><strong>Date:</strong> ${eventDetails.date}</li>
      <li><strong>Time:</strong> ${eventDetails.time}</li>
      <li><strong>Location:</strong> ${eventDetails.location}, ${eventDetails.city}</li>
      <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
    </ul>
  `;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Registration Confirmed: ${eventDetails.name}`,
    html,
  });
}

module.exports = {
  sendTicketEmail,
  resendTicketEmail,
  sendRegistrationEmail,
  generateTicketQR,
  buildTicketEmailHtml,
};
