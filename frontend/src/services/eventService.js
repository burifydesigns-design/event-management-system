import api from './api'
import { supabase, isSupabaseConfigured } from './supabase'

// ---- Public reads go straight to Supabase (row-level security allows anon to read
// published events). Falls back to the API when Supabase is not configured.

const EVENT_COLUMNS = '*, ticket_types(id, name, price, quantity_available, quantity_sold)'

// Turn a database row into the shape the pages expect.
const toEvent = (row) => {
  if (!row) return row
  const { ticket_types: tiers = [], event_date, event_time, ...rest } = row
  const sold = tiers.reduce((sum, t) => sum + (t.quantity_sold || 0), 0)
  return {
    ...rest,
    _id: row.id,
    date: event_date,
    time: event_time,
    price: Number(row.price) || 0,
    registeredCount: sold,
    ticketTypes: tiers.map((t) => ({
      _id: t.id,
      id: t.id,
      name: t.name,
      price: Number(t.price) || 0,
      quantity: t.quantity_available,
      sold: t.quantity_sold,
    })),
  }
}

// Strip characters that would break out of a PostgREST filter expression.
const cleanTerm = (value) => String(value).replace(/[,()%*\\]/g, ' ').trim()

export const getEvents = async (params = {}) => {
  if (!isSupabaseConfigured) {
    const { data } = await api.get('/events', { params })
    return data
  }

  const { search, category, city, date, price } = params
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 12))
  const now = new Date().toISOString()

  let query = supabase
    .from('events')
    .select(EVENT_COLUMNS, { count: 'exact' })
    .eq('status', 'published')

  const term = search ? cleanTerm(search) : ''
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,city.ilike.%${term}%`)
  if (category) query = query.eq('category', category)
  if (city) query = query.ilike('city', `%${cleanTerm(city)}%`)
  if (date === 'upcoming') query = query.gte('event_date', now)
  if (date === 'past') query = query.lt('event_date', now)
  if (price === 'free') query = query.eq('price', 0)
  if (price === 'paid') query = query.gt('price', 0)

  const { data, error, count } = await query
    .order('event_date', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)
  if (error) throw error

  const total = count || 0
  return {
    events: (data || []).map(toEvent),
    page,
    limit,
    totalEvents: total,
    totalPages: Math.ceil(total / limit),
  }
}

export const getEvent = async (id) => {
  if (!isSupabaseConfigured) {
    const { data } = await api.get(`/events/${id}`)
    return data
  }

  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const notFound = new Error('Event not found')
    notFound.response = { status: 404, data: { message: 'Event not found' } }
    throw notFound
  }
  return toEvent(data)
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
  const { data } = await api.patch(`/events/${id}/publish`)
  return data
}

export const getMyEvents = async () => {
  const { data } = await api.get('/events/my')
  return data
}
