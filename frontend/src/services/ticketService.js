import api from './api'

export const getTicket = async (ticketId) => {
  const { data } = await api.get(`/tickets/${ticketId}`)
  return data
}
