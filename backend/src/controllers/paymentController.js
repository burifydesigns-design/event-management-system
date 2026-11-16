const { getSupabase } = require('../config/db');
const { initiateMpesaStkPush, verifyMpesaStkPush, normalizeKenyanPhone } = require('../services/paymentService');
const db = () => getSupabase();

exports.initiateMpesaPayment = async (req, res, next) => {
  try {
    const { orderId, phone } = req.body || {};
    if (!orderId || !phone) return res.status(400).json({ message: 'orderId and phone are required' });
    const normalizedPhone = normalizeKenyanPhone(phone);

    const { data: order, error: orderError } = await db().from('orders')
      .select('id,attendee_id,total_amount,currency,status,hold_expires_at')
      .eq('id', orderId).eq('attendee_id', req.user.userId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'pending' || !order.hold_expires_at || Date.parse(order.hold_expires_at) <= Date.now()) {
      return res.status(409).json({ message: 'This ticket hold has expired. Please start checkout again.' });
    }
    if (order.currency !== 'KES') return res.status(400).json({ message: 'M-Pesa checkout is only available for KES orders.' });

    const { data: payment, error: paymentError } = await db().from('payments')
      .select('id,amount,currency,status,provider_checkout_id')
      .eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || !['pending','processing'].includes(payment.status)) {
      return res.status(409).json({ message: 'No payable payment attempt exists for this order.' });
    }
    if (payment.provider_checkout_id) {
      return res.status(200).json({ status: 'processing', message: 'An M-Pesa payment prompt has already been initiated for this order.' });
    }

    const requiredConfig = ['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY','MPESA_CALLBACK_URL'];
    const missingConfig = requiredConfig.filter((key) => !process.env[key]);
    if (String(process.env.PAYMENT_PROVIDER || '').toLowerCase() !== 'mpesa' || missingConfig.length) {
      return res.status(503).json({ message: 'M-Pesa is not fully configured on the server.' });
    }

    // Claim the payment attempt before calling Safaricom so concurrent requests
    // cannot create multiple STK prompts for the same order.
    const { data: claimed, error: claimError } = await db().from('payments').update({
      provider: 'mpesa', status: 'processing', provider_phone: normalizedPhone,
    }).eq('id', payment.id).eq('status', 'pending').is('provider_checkout_id', null)
      .select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return res.status(409).json({ message: 'A payment prompt is already being processed for this order.' });

    const providerResponse = await initiateMpesaStkPush({
      amount: Number(payment.amount),
      phone: normalizedPhone,
      orderId: order.id,
    });
    if (String(providerResponse.ResponseCode) !== '0' || !providerResponse.CheckoutRequestID) {
      await db().from('payments').update({ status: 'pending', provider_phone: null })
        .eq('id', payment.id).eq('status', 'processing').is('provider_checkout_id', null);
      return res.status(502).json({ message: providerResponse.ResponseDescription || 'M-Pesa did not accept the payment request.' });
    }

    const { error: updateError } = await db().from('payments').update({
      provider: 'mpesa',
      provider_checkout_id: providerResponse.CheckoutRequestID,
      provider_merchant_id: providerResponse.MerchantRequestID || null,
      provider_phone: normalizedPhone,
      status: 'processing',
    }).eq('id', payment.id);
    if (updateError) throw updateError;

    res.status(202).json({
      status: 'processing',
      checkoutRequestId: providerResponse.CheckoutRequestID,
      customerMessage: providerResponse.CustomerMessage || 'Check your phone and enter your M-Pesa PIN to complete payment.',
    });
  } catch (err) {
    if (/M-Pesa|Kenyan mobile|whole-number KES|HTTPS MPESA_CALLBACK_URL|shortcode|passkey/i.test(err.message)) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

// Safaricom callbacks are not treated as proof of payment. A server-to-server STK
// query is performed before the database settlement RPC can issue any tickets.
exports.mpesaCallback = async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    if (!checkoutRequestId) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (Number(callback.ResultCode) !== 0) {
      await db().rpc('fail_mpesa_order_payment', {
        p_checkout_request_id: checkoutRequestId,
        p_reason: callback.ResultDesc || 'M-Pesa payment was not completed',
        p_provider_event: req.body,
      });
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const verified = await verifyMpesaStkPush(checkoutRequestId);
    if (String(verified.ResponseCode) !== '0' || String(verified.ResultCode) !== '0') {
      await db().rpc('fail_mpesa_order_payment', {
        p_checkout_request_id: checkoutRequestId,
        p_reason: verified.ResultDesc || 'M-Pesa verification did not confirm payment',
        p_provider_event: { callback: req.body, verification: verified },
      });
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const metadata = callback.CallbackMetadata?.Item || [];
    const value = (name) => metadata.find((item) => item.Name === name)?.Value;
    const receipt = value('MpesaReceiptNumber');
    // The callback body is not a trusted payment source. The verified STK query
    // confirms success; settle against the expected amount already stored in Postgres.
    const { data: paymentRow, error: paymentLookupError } = await db().from('payments')
      .select('amount').eq('provider', 'mpesa').eq('provider_checkout_id', checkoutRequestId).maybeSingle();
    if (paymentLookupError) throw paymentLookupError;
    if (!paymentRow) throw new Error('M-Pesa payment reference not found');
    const amount = Number(paymentRow.amount);
    const currency = 'KES';
    const { error } = await db().rpc('complete_mpesa_order_payment', {
      p_checkout_request_id: checkoutRequestId,
      p_receipt: receipt,
      p_amount: amount,
      p_currency: currency,
      p_provider_event: { callback: req.body, verification: verified },
    });
    if (error) throw error;
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    // Always acknowledge callback transport; failed settlements are observable in server logs
    // and can be reconciled using the provider reference without issuing duplicate tickets.
    console.error('M-Pesa callback processing failed:', error.message);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted for reconciliation' });
  }
};
