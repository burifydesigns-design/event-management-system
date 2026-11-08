const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const requireSupabaseConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Events are temporarily unavailable because the Supabase connection is not configured.')
  }
}

const normalizeEvent = (event) => ({
  ...event,
  id: event.id,
  _id: event.id,
  date: event.event_date,
  time: event.event_time,
  registeredCount: event.registered_count ?? 0,
})

const requestEvents = async (params = {}) => {
  requireSupabaseConfig()

  const query = new URLSearchParams({
    select: '*',
    status: 'eq.published',
    order: 'event_date.asc',
    limit: '1000',
  })

  if (params.category) query.set('category', `eq.${params.category}`)
  if (params.date === 'upcoming') query.set('event_date', `gte.${new Date().toISOString()}`)
  if (params.date === 'past') query.set('event_date', `lt.${new Date().toISOString()}`)
  if (params.price === 'free') query.set('price', 'eq.0')
  if (params.price === 'paid') query.set('price', 'gt.0')

  const response = await fetch(`${SUPABASE_URL}/rest/v1/events?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Unable to load events (${response.status}): ${detail || response.statusText}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error('The events service returned an unexpected response.')
  return rows.map(normalizeEvent)
}

export const getEvents = async (params = {}) => {
  let events = await requestEvents(params)

  if (params.search) {
    const term = params.search.trim().toLocaleLowerCase()
    events = events.filter((event) =>
      [event.title, event.description, event.city, event.location, event.category]
        .some((value) => String(value || '').toLocaleLowerCase().includes(term))
    )
  }

  return { events, totalEvents: events.length, page: 1, totalPages: events.length ? 1 : 0 }
}

export const getEvent = async (id) => {
  requireSupabaseConfig()
  const query = new URLSearchParams({
    select: '*',
    id: `eq.${id}`,
    status: 'eq.published',
    limit: '1',
  })
  const response = await fetch(`${SUPABASE_URL}/rest/v1/events?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Unable to load this event (${response.status}): ${detail || response.statusText}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('Event not found')
    error.status = 404
    throw error
  }
  return normalizeEvent(rows[0])
}

// Event creation and management remain on the authenticated backend API.
import api from './api'

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
  const { data } = await api.patch(`/events/${id}/publish`)
  return data
}

export const getMyEvents = async () => {
  const { data } = await api.get('/events/my')
  return data
}
