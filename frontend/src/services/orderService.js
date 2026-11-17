import api from './api'

export const createOrder = async ({ eventId, ticketTypeId, quantity, idempotencyKey }) => {
  // Keep the same key for retries of one checkout attempt. Callers may supply a
  // key when retrying after a network failure; otherwise create one per attempt.
  const key = idempotencyKey || (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const { data } = await api.post('/orders', { eventId, ticketTypeId, quantity }, {
    headers: { 'Idempotency-Key': key },
  })
  return { ...data, idempotencyKey: key }
}

export const initiateMpesaPayment = async ({ orderId, phone }) => {
  const { data } = await api.post('/payments/mpesa/stk-push', { orderId, phone })
  return data
}
