const QRCode = require('qrcode');
const crypto = require('crypto');

function generateTicketToken() {
  return crypto.randomUUID();
}

async function generateQRImage(token) {
  // returns a base64 data URL you can store or send to the frontend
  return QRCode.toDataURL(token);
}

module.exports = { generateTicketToken, generateQRImage };
