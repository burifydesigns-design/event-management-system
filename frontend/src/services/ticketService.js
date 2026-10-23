import api from './api'

export const getMyTickets = async (params = {}) => {
  const { data } = await api.get('/tickets/my', { params })
  return data
}

export const getTicket = async (id) => {
  const { data } = await api.get(`/tickets/${id}`)
  return data
}

export const getTicketQR = async (id) => {
  const { data } = await api.get(`/tickets/${id}/qr`)
  return data
}

export const validateTicket = async (qrToken, eventId) => {
  const { data } = await api.post('/tickets/validate', { qrToken, eventId })
  return data
}

export const checkInTicket = async (qrToken, eventId) => {
  const { data } = await api.post('/tickets/check-in', { qrToken, eventId })
  return data
}

export const issueTicket = async ({ userId, eventId, ticketTypeId, orderId }) => {
  const { data } = await api.post('/tickets/issue', { userId, eventId, ticketTypeId, orderId })
  return data
}

export const resendTicketEmail = async (id) => {
  const { data } = await api.post(`/tickets/${id}/resend-email`)
  return data
}

export const getScannerEvents = async () => {
  const { data } = await api.get('/scan/events')
  return data
}

export const getScanHistory = async (params = {}) => {
  const { data } = await api.get('/scan/history', { params })
  return data
}

export const getCoordinatorEvents = async () => {
  const { data } = await api.get('/coordinator/me/events')
  return data
}

export const createCoordinatorAssignment = async ({ coordinatorId, eventId }) => {
  const { data } = await api.post('/coordinator/assignments', { coordinatorId, eventId })
  return data
}

export const listCoordinatorAssignments = async (params = {}) => {
  const { data } = await api.get('/coordinator/assignments', { params })
  return data
}

export const deleteCoordinatorAssignment = async (id) => {
  const { data } = await api.delete(`/coordinator/assignments/${id}`)
  return data
}

export const listCoordinators = async () => {
  const { data } = await api.get('/coordinator/coordinators')
  return data
}

export const getOverviewAnalytics = async () => {
  const { data } = await api.get('/analytics/overview')
  return data
}

export const getEventAnalytics = async (eventId) => {
  const { data } = await api.get(`/analytics/events/${eventId}`)
  return data
}

export const getPlatformAnalytics = async (params = {}) => {
  const { data } = await api.get('/analytics/platform', { params })
  return data
}

export const getOrganizerAnalytics = async (params = {}) => {
  const { data } = await api.get('/analytics/organizer', { params })
  return data
}

export const getCoordinatorPerformance = async (params = {}) => {
  const { data } = await api.get('/analytics/coordinator-performance', { params })
  return data
}

export const exportRegistrationsCSV = async (params = {}) => {
  const { data } = await api.get('/analytics/export/csv', { params, responseType: 'blob' })
  return data
}
