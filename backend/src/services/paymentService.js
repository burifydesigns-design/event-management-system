// Plug in M-Pesa (Daraja API), Stripe, etc. here.
async function initiatePayment({ amount, phoneOrEmail, orderId }) {
  // TODO: integrate real payment provider
  return { status: 'pending', reference: `TEMP-${orderId}` };
}

module.exports = { initiatePayment };
