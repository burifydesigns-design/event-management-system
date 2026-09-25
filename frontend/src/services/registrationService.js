import api from './api'

export const registerForEvent = async (eventId) => {
  const { data } = await api.post('/registrations', { eventId })
  return data
}

export const getMyRegistrations = async () => {
  const { data } = await api.get('/registrations/my')
  return data
}

export const getMyEvents = async () => {
  const { data } = await api.get('/registrations/my-events')
  return data
}

export const getRegistration = async (id) => {
  const { data } = await api.get(`/registrations/${id}`)
  return data
}

export const cancelRegistration = async (id) => {
  const { data } = await api.delete(`/registrations/${id}`)
  return data
}

export const getMyReminders = async () => {
  const { data } = await api.get('/reminders/my')
  return data
}

export const updateNotificationPreferences = async (preferences) => {
  const { data } = await api.put('/reminders/preferences', preferences)
  return data
}
