const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendRegistrationEmail(to, eventDetails, ticketNumber) {
  try {
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
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: `Registration Confirmed: ${eventDetails.name}`,
      html,
    });
  } catch (err) {
    console.error('Failed to send registration email:', err.message);
  }
}

module.exports = { sendRegistrationEmail };
