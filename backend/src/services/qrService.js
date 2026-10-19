const QRCode = require('qrcode');
const crypto = require('crypto');

function generateTicketToken() {
  return crypto.randomUUID();
}

async function generateQRImage(token) {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    width: 300,
  });
}

async function generateRegistrationQR(ticketNumber) {
  const payload = `EVT1:${ticketNumber}`;
  return generateQRImage(payload);
}

module.exports = { generateTicketToken, generateQRImage, generateRegistrationQR };
