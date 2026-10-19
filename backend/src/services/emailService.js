const nodemailer = require('nodemailer');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

let transporter = null;
let testTransporter = null;
let isInitialized = false;
let configValid = false;

function validateConfig() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`Email service: Missing configuration: ${missing.join(', ')}. Email functionality will be disabled.`);
    return false;
  }
  return true;
}

function createTransporter(config = {}) {
  const host = config.SMTP_HOST || process.env.SMTP_HOST;
  const port = Number(config.SMTP_PORT || process.env.SMTP_PORT || 587);
  const secure = config.SMTP_SECURE !== undefined ? config.SMTP_SECURE : (process.env.SMTP_SECURE === 'true');
  const user = config.SMTP_USER || process.env.SMTP_USER;
  const pass = config.SMTP_PASS || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });
}

function initializeEmailService() {
  if (isInitialized) return configValid;
  
  isInitialized = true;
  configValid = validateConfig();
  
  if (configValid) {
    transporter = createTransporter();
    transporter.verify((err) => {
      if (err) {
        console.error('Email service: SMTP connection verification failed:', err.message);
        configValid = false;
      } else {
        console.log('Email service: SMTP connection verified successfully');
      }
    });
  }
  
  return configValid;
}

function getTransporter() {
  if (testTransporter) return testTransporter;
  if (!transporter && configValid) {
    transporter = createTransporter();
  }
  return transporter;
}

function setTestTransporter(transporterInstance) {
  testTransporter = transporterInstance;
}

function clearTestTransporter() {
  testTransporter = null;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function formatEventDate(date) {
  if (!date) return 'TBD';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'TBD';
  }
}

function buildRegistrationConfirmationEmail(registration, event, user) {
  const ticketNumber = registration.ticketNumber;
  const eventTitle = escapeHtml(event?.title || 'Event');
  const eventDate = formatEventDate(event?.date);
  const eventTime = escapeHtml(event?.time || 'TBD');
  const eventLocation = escapeHtml(event?.location || 'TBD');
  const eventCity = escapeHtml(event?.city || '');
  const attendeeName = escapeHtml(user?.name || 'Attendee');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const ticketUrl = `${clientUrl}/my-ticket/${registration._id}`;

  const locationDisplay = eventCity ? `${eventLocation}, ${eventCity}` : eventLocation;

  const subject = `Registration confirmed: ${eventTitle}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center; padding-bottom: 30px; border-bottom: 2px solid #e8e8e8;">
              <h1 style="margin: 0; color: #2c3e50; font-size: 28px; font-weight: 600;">Registration Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 0;">
              <p style="margin: 0 0 16px; font-size: 16px;">Hello <strong>${attendeeName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 16px;">You have successfully registered for <strong>${eventTitle}</strong>.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e8e8;">
                    <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 100px;">Event:</span>
                    <span style="font-weight: 600; color: #2c3e50;">${eventTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e8e8;">
                    <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 100px;">Date:</span>
                    <span style="color: #2c3e50;">${eventDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e8e8;">
                    <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 100px;">Time:</span>
                    <span style="color: #2c3e50;">${eventTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e8e8;">
                    <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 100px;">Venue:</span>
                    <span style="color: #2c3e50;">${locationDisplay}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 100px;">Ticket #:</span>
                    <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #2c3e50; font-size: 16px;">${escapeHtml(ticketNumber)}</span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 16px;">Please keep your ticket number for reference. You can also view your digital ticket online:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <a href="${escapeHtml(ticketUrl)}" style="display: inline-block; background-color: #3498db; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">View Your Ticket</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 30px; border-top: 2px solid #e8e8e8; text-align: center;">
              <p style="margin: 0 0 8px; color: #6c757d; font-size: 14px;">We look forward to seeing you at the event!</p>
              <p style="margin: 0; color: #6c757d; font-size: 12px;">If you have any questions, please contact support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding-top: 20px; color: #999; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Registration Confirmed

Hello ${attendeeName},

You have successfully registered for ${eventTitle}.

Event: ${eventTitle}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${locationDisplay}
Ticket Number: ${ticketNumber}

Please keep your ticket number for reference.

View your ticket online: ${ticketUrl}

We look forward to seeing you at the event!

---
This is an automated message. Please do not reply to this email.
`;

  return { subject, html, text };
}

async function sendRegistrationConfirmation({ registrationId }) {
  if (!configValid && !testTransporter) {
    return { status: 'not_configured', message: 'Email service not configured' };
  }

  try {
    const registration = await Registration.findById(registrationId)
      .populate('user', 'name email')
      .populate('event');

    if (!registration) {
      console.warn(`Email service: Registration ${registrationId} not found`);
      return { status: 'not_found', message: 'Registration not found' };
    }

    if (registration.status !== 'confirmed') {
      console.warn(`Email service: Registration ${registrationId} is not confirmed (status: ${registration.status})`);
      return { status: 'skipped', message: 'Registration not confirmed' };
    }

    if (!registration.ticketNumber) {
      console.warn(`Email service: Registration ${registrationId} has no ticket number`);
      return { status: 'failed', message: 'Missing ticket number' };
    }

    const user = registration.user;
    if (!user?.email) {
      console.warn(`Email service: User for registration ${registrationId} has no email`);
      return { status: 'no_recipient', message: 'User has no email address' };
    }

    const event = registration.event;
    if (!event) {
      console.warn(`Email service: Event for registration ${registrationId} not found`);
      return { status: 'failed', message: 'Event not found' };
    }

    const { subject, html, text } = buildRegistrationConfirmationEmail(registration, event, user);
    const from = process.env.EMAIL_FROM;
    const mailTransporter = getTransporter();

    if (!mailTransporter) {
      return { status: 'not_configured', message: 'Email transporter not available' };
    }

    const info = await mailTransporter.sendMail({
      from,
      to: user.email,
      subject,
      html,
      text,
    });

    console.log(`Email service: Confirmation email sent for registration ${registrationId} (messageId: ${info.messageId})`);
    return { status: 'sent', messageId: info.messageId };
  } catch (err) {
    const errorMessage = err?.message || 'Unknown error';
    console.error(`Email service: Failed to send confirmation email for registration ${registrationId}: ${errorMessage}`);
    return { status: 'failed', message: errorMessage };
  }
}

async function shutdown() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}

module.exports = {
  initializeEmailService,
  sendRegistrationConfirmation,
  setTestTransporter,
  clearTestTransporter,
  shutdown,
  validateConfig,
  buildRegistrationConfirmationEmail,
  escapeHtml,
  formatEventDate,
};