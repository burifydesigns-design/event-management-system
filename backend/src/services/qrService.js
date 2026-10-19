const QRCode = require('qrcode');
const crypto = require('crypto');

const MAX_QR_PAYLOAD_LENGTH = 255;

function generateTicketToken() {
  return crypto.randomUUID();
}

function parseRegistrationQRPayload(payload) {
  if (typeof payload !== 'string') {
    return null;
  }

  const trimmed = payload.trim();
  if (!trimmed || trimmed.length > MAX_QR_PAYLOAD_LENGTH) {
    return null;
  }

  const normalized = trimmed.replace(/^\s+|\s+$/g, '');
  const jwtLike = normalized.split('.');
  if (jwtLike.length === 3 && jwtLike.every(Boolean)) {
    return null;
  }

  const ticketNumber = normalized.startsWith('EVT1:') ? normalized.slice(5) : normalized;
  if (!ticketNumber || ticketNumber.includes(' ')) {
    return null;
  }

  const hasAllowedPrefix = /^EVT-[A-Za-z0-9-]+$/.test(ticketNumber) || /^EVT[0-9A-Z-]+$/.test(ticketNumber);
  if (!hasAllowedPrefix) {
    return null;
  }

  return ticketNumber;
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

module.exports = {
  generateTicketToken,
  generateQRImage,
  generateRegistrationQR,
  parseRegistrationQRPayload,
};
