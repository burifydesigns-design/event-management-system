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

export const scanQR = async (qrToken, eventId) => {
  const { data } = await api.post('/admin/scan', { qrToken, eventId })
  return data
}

export const getAnalytics = async () => {
  const { data } = await api.get('/admin/analytics')
  return data
}

export const updateUserRole = async (userId, role) => {
  const { data } = await api.put(`/admin/users/${userId}`, { role })
  return data
}

export const deleteUser = async (userId) => {
  const { data } = await api.delete(`/admin/users/${userId}`)
  return data
}
