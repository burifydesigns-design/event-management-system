import api from './api'

export const getEvents = async (params = {}, options = {}) => {
  const { data } = await api.get('/events', { params, ...options })
  return data
}

export const getEvent = async (id) => {
  const { data } = await api.get(`/events/${id}`)
  return data
}

export const createEvent = async (eventData) => {
  const { data } = await api.post('/events', eventData)
  return data
}

export const updateEvent = async (id, eventData) => {
  const { data } = await api.put(`/events/${id}`, eventData)
  return data
}

export const deleteEvent = async (id) => {
  const { data } = await api.delete(`/events/${id}`)
  return data
}

export const publishEvent = async (id) => {
  const { data } = await api.put(`/events/${id}/publish`)
  return data
}
