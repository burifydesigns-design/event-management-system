import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getEvents } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const navigate = useNavigate()

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {}
      if (search) params.search = search
      if (category) params.category = category
      if (dateFilter) params.date = dateFilter
      const data = await getEvents(params)
      setEvents(data.events || [])
    } catch (err) {
      setError(err?.message || 'Failed to load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [search, category, dateFilter])

  useEffect(() => {
    const t = setTimeout(fetchEvents, 150)
    return () => clearTimeout(t)
  }, [search, category, dateFilter, fetchEvents])

  const categories = [...new Set(events.map((e) => e.category))].sort()

  if (loading) return <Loading text="Loading events..." />
  if (error) return <ErrorMessage message={error} />

  const filtered = events.filter((e) => {
    if (category && e.category !== category) return false
    if (dateFilter && e.date) {
      const d = new Date(e.date).toISOString().slice(0, 10)
      if (dateFilter === 'upcoming' && d < new Date().toISOString().slice(0, 10)) return false
      if (dateFilter === 'past' && d >= new Date().toISOString().slice(0, 10)) return false
    }
    return true
  })

  return (
    <div className="page page--events">
      <div className="container">
        <h1>Discover events</h1>
        <p style={{ color: 'var(--mu)', fontSize: 14, marginBottom: 16 }}>Find and register for events happening around you.</p>
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="visually-hidden">Search events</label>
          <input className="input" type="search" placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>
        <div className="stubs">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--mu)', textAlign: 'center' }}>No events match your filters.</p>
          ) : (
            filtered.map((event) => {
              const left = (event.capacity || 0) - (event.registeredCount || 0)
              const price = event.price || 0
              return (
                <button key={event._id || event.id} type="button" className="stub" style={{ '--a': event.colorA || '#0b6b4f', '--b': event.colorB || '#f2b01e', '--fill': `${Math.min(100, Math.round(((event.registeredCount || 0) / Math.max(1, event.capacity || 1)) * 100))}%` }} onClick={() => navigate(`/events/${event._id || event.id}`)} aria-label={`View ${event.title}`}>
                  <div className="stub__date">
                    <div className="stub__day">{new Date(event.date).getDate()}</div>
                    <div className="stub__month">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                    <span className="stub__notches" aria-hidden="true" />
                  </div>
                  <div className="stub__body">
                    <div className="stub__title">{event.title}</div>
                    <div className="stub__venue">{event.location}</div>
                    <div className="stub__price">From KES {price.toLocaleString()}</div>
                    <div className="stub__meter"><div className="stub__meter-fill" /></div>
                    {left < 150 && <div className="stub__left stub__left--low">Only {left} left</div>}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
