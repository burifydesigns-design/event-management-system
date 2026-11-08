import api from './api'

export const createOrder = async ({ eventId, ticketTypeId, quantity }) => {
  const { data } = await api.post('/orders', { eventId, ticketTypeId, quantity })
  return data
}
