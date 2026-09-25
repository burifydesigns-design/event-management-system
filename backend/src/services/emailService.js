const nodemailer = require('nodemailer');
const {
  generateRegistrationConfirmationHtml,
  generateRegistrationConfirmationText,
} = require('../templates/registrationConfirmation');
const {
  generateReminder24hHtml,
  generateReminder24hText,
  generateReminder1hHtml,
  generateReminder1hText,
} = require('../templates/reminderEmails');

let transporter = null;
let isTransporterVerified = false;

function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function getTransporter() {
  if (!transporter) {
    const created = createTransporter();
    if (created) {
      transporter = created;
    }
  }
  return transporter;
}

async function verifyTransporter() {
  const transport = getTransporter();
  if (!transport) {
    return false;
  }
  if (isTransporterVerified) {
    return true;
  }
  try {
    await transport.verify();
    isTransporterVerified = true;
    console.log('Email transporter verified successfully');
    return true;
  } catch (err) {
    console.warn('Email transporter verification failed:', err.message);
    return false;
  }
}

async function sendEmail({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    throw new Error('Email transporter not configured. Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS environment variables.');
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) {
    throw new Error('EMAIL_FROM or EMAIL_USER not configured');
  }

  if (!to || !validateEmail(to)) {
    throw new Error('Invalid recipient email address');
  }

  const mailOptions = {
    from,
    to,
    subject,
    html,
    text,
  };

  const info = await transport.sendMail(mailOptions);
  return info;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function sendRegistrationConfirmationEmail(user, event, registration, baseUrl, qrImage) {
  const to = user.email;
  if (!to || !validateEmail(to)) {
    console.warn(`Cannot send registration email: invalid or missing email for user ${user._id}`);
    return { success: false, reason: 'Invalid recipient email' };
  }

  const myEventsUrl = `${baseUrl}/my-events`;
  const ticketUrl = `${baseUrl}/my-ticket/${registration._id}`;

  const templateData = {
    userName: user.name,
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    eventLocation: event.location,
    eventCity: event.city,
    ticketNumber: registration.ticketNumber,
    myEventsUrl,
    ticketUrl,
    qrImage: qrImage || null,
  };

  const subject = `Registration Confirmed: ${event.title}`;
  const html = generateRegistrationConfirmationHtml(templateData);
  const text = generateRegistrationConfirmationText(templateData);

  try {
    const info = await sendEmail({ to, subject, html, text });
    console.log(`Registration confirmation email sent to ${to} for event ${event._id}, registration ${registration._id}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Failed to send registration confirmation email to ${to} for registration ${registration._id}:`, err.message);
    return { success: false, reason: err.message };
  }
}

async function testEmailConfiguration() {
  const transport = getTransporter();
  if (!transport) {
    return { configured: false, reason: 'Missing email configuration' };
  }
  try {
    await transport.verify();
    return { configured: true };
  } catch (err) {
    return { configured: false, reason: err.message };
  }
}

function getBaseUrl(req) {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
}

function buildTicketUrl(baseUrl, registrationId) {
  return `${baseUrl}/my-ticket/${registrationId}`;
}

function buildEventUrl(baseUrl, eventId) {
  return `${baseUrl}/events/${eventId}`;
}

async function sendReminder24hEmail(user, event, registration, baseUrl) {
  const to = user.email;
  if (!to || !validateEmail(to)) {
    console.warn(`Cannot send 24h reminder email: invalid or missing email for user ${user._id}`);
    return { success: false, reason: 'Invalid recipient email' };
  }

  const ticketUrl = buildTicketUrl(baseUrl, registration._id);

  const templateData = {
    userName: user.name,
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    eventLocation: event.location,
    eventCity: event.city,
    ticketNumber: registration.ticketNumber,
    ticketUrl,
    organizerName: event.organizerName || '',
  };

  const subject = `Reminder: ${event.title} starts tomorrow`;
  const html = generateReminder24hHtml(templateData);
  const text = generateReminder24hText(templateData);

  try {
    const info = await sendEmail({ to, subject, html, text });
    console.log(`24h reminder email sent to ${to} for event ${event._id}, registration ${registration._id}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Failed to send 24h reminder email to ${to} for registration ${registration._id}:`, err.message);
    return { success: false, reason: err.message };
  }
}

async function sendReminder1hEmail(user, event, registration, baseUrl) {
  const to = user.email;
  if (!to || !validateEmail(to)) {
    console.warn(`Cannot send 1h reminder email: invalid or missing email for user ${user._id}`);
    return { success: false, reason: 'Invalid recipient email' };
  }

  const ticketUrl = buildTicketUrl(baseUrl, registration._id);

  const templateData = {
    userName: user.name,
    eventTitle: event.title,
    eventTime: event.time,
    eventLocation: event.location,
    eventCity: event.city,
    ticketNumber: registration.ticketNumber,
    ticketUrl,
  };

  const subject = `Starting Soon: ${event.title}`;
  const html = generateReminder1hHtml(templateData);
  const text = generateReminder1hText(templateData);

  try {
    const info = await sendEmail({ to, subject, html, text });
    console.log(`1h reminder email sent to ${to} for event ${event._id}, registration ${registration._id}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Failed to send 1h reminder email to ${to} for registration ${registration._id}:`, err.message);
    return { success: false, reason: err.message };
  }
}

module.exports = {
  sendRegistrationConfirmationEmail,
  sendReminder24hEmail,
  sendReminder1hEmail,
  sendEmail,
  verifyTransporter,
  testEmailConfiguration,
  validateEmail,
};