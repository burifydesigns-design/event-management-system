// Plug in nodemailer, SendGrid, etc. here.
async function sendTicketEmail({ to, subject, html }) {
  // TODO: integrate real email provider
  console.log(`Email to ${to}: ${subject}`);
}

module.exports = { sendTicketEmail };
