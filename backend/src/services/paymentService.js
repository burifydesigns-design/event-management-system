const crypto = require('crypto');

const mpesaBaseUrl = () => process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

function timestampNairobi() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

function normalizeKenyanPhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  throw new Error('Enter a valid Kenyan mobile number, for example 07XXXXXXXX');
}

async function mpesaAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('M-Pesa credentials are not configured');
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  const response = await fetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error('Could not authenticate with M-Pesa');
  return payload.access_token;
}

function mpesaPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!shortcode || !passkey) throw new Error('M-Pesa shortcode and passkey are not configured');
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

async function mpesaRequest(path, body) {
  const token = await mpesaAccessToken();
  const response = await fetch(`${mpesaBaseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.errorMessage || payload.ResponseDescription || 'M-Pesa request failed');
  return payload;
}

async function initiateMpesaStkPush({ amount, phone, orderId }) {
  if (String(process.env.PAYMENT_PROVIDER || '').toLowerCase() !== 'mpesa') {
    throw new Error('Set PAYMENT_PROVIDER=mpesa to enable M-Pesa checkout');
  }
  if (!process.env.MPESA_CALLBACK_URL || !/^https:\/\//i.test(process.env.MPESA_CALLBACK_URL)) {
    throw new Error('A public HTTPS MPESA_CALLBACK_URL is required');
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error('M-Pesa checkout requires a positive whole-number KES amount');
  }
  const shortcode = process.env.MPESA_SHORTCODE;
  if (!shortcode) throw new Error('M-Pesa shortcode is not configured');
  const timestamp = timestampNairobi();
  const phoneNumber = normalizeKenyanPhone(phone);
  return mpesaRequest('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: shortcode,
    Password: mpesaPassword(timestamp),
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: value,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: String(orderId).slice(0, 12),
    TransactionDesc: String(process.env.MPESA_TRANSACTION_DESC || 'Event ticket').slice(0, 13),
  });
}

async function verifyMpesaStkPush(checkoutRequestId) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const timestamp = timestampNairobi();
  if (!checkoutRequestId || !shortcode) throw new Error('M-Pesa callback reference is incomplete');
  return mpesaRequest('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: shortcode,
    Password: mpesaPassword(timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });
}

module.exports = { initiateMpesaStkPush, verifyMpesaStkPush, normalizeKenyanPhone };
