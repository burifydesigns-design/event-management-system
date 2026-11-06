import api from './api'

export const createOrder = async ({ eventId, ticketTypeId, quantity }) => {
  const { data } = await api.post('/orders', { eventId, ticketTypeId, quantity })
  return data
}

export const confirmPayment = async ({ orderId }) => {
  const { data } = await api.post('/orders/confirm-payment', { orderId })
  return data
}
