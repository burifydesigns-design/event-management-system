import api from './api'

export const getDashboard = async () => {
  const { data } = await api.get('/admin/dashboard')
  return data
}

export const getAllEvents = async () => {
  const { data } = await api.get('/admin/events')
  return data
}

export const getAllUsers = async () => {
  const { data } = await api.get('/admin/users')
  return data
}

export const getEventAttendees = async (eventId) => {
  const { data } = await api.get(`/admin/events/${eventId}/attendees`)
  return data
}

export const exportAttendeesCSV = async (eventId) => {
  const { data } = await api.get(`/admin/events/${eventId}/attendees/export`, {
    responseType: 'blob',
  })
  return data
}

export const checkInTicket = async (ticketNumber, eventId) => {
  const { data } = await api.post('/tickets/check-in', { ticketNumber, eventId })
  return data
}

export const getAnalytics = async () => {
  const { data } = await api.get('/admin/analytics')
  return data
}

export const updateUserRole = async (userId, role) => {
  const { data } = await api.patch(`/admin/users/${userId}/role`, { role })
  return data
}

export const deleteUser = async (userId) => {
  const { data } = await api.delete(`/admin/users/${userId}`)
  return data
}
