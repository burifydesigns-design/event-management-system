import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEvents } from '../services/eventService'
import TicketSheet from '../components/TicketSheet'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

const CHIPS = ['All', 'Music', 'Food', 'Tech', 'Arts']
const CAT_MAP = { Music: 'Music', Food: 'Food', Tech: 'Technology', Arts: 'Arts' }

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Home() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('All')
  const [sheetEvent, setSheetEvent] = useState(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {}
      if (search) params.search = search
      const data = await getEvents(params)
      setEvents(data.events || [])
    } catch (err) {
      setError(err?.message || 'Failed to load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchEvents, 150)
    return () => clearTimeout(t)
  }, [search, fetchEvents])

  if (loading) return <Loading text="Loading events..." />
  if (error) return <ErrorMessage message={error} />

  const filtered = chip === 'All'
    ? events
    : events.filter((e) => e.category === CAT_MAP[chip])

  const featured = filtered[0]

  return (
    <div className="page page--discover">
      {sheetEvent && (
        <TicketSheet event={sheetEvent} onClose={() => setSheetEvent(null)} />
      )}
      <div className="container">
        <h1>Nairobi, this week.</h1>
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="visually-hidden">Search events</label>
          <input
            className="input"
            type="search"
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chips">
          {CHIPS.map((c) => {
            const active = chip === c
            return (
              <button
                key={c}
                type="button"
                className={`chip ${active ? 'chip--selected' : ''}`}
                onClick={() => setChip(c)}
              >
                {c}
              </button>
            )
          })}
        </div>

        {featured && (
          <div className="poster" style={{ '--a': featured.colorA || '#c42a55', '--b': featured.colorB || '#ffb703' }}>
            <div className="poster__art" aria-hidden="true" />
            <div className="poster__body">
              <span className="poster__kicker">Featured this week</span>
              <div className="poster__day" aria-label={fmtDate(featured.date)}>{new Date(featured.date).getDate()}</div>
              <h2 className="poster__title">{featured.title}</h2>
              <p className="poster__meta">{fmtDate(featured.date)} at {featured.location}</p>
              <button type="button" className="btn btn--primary" onClick={() => setSheetEvent(featured)} style={{ marginTop: 10, alignSelf: 'start' }}>
                Get tickets
              </button>
            </div>
          </div>
        )}

        <h2 style={{ fontSize: 20, margin: '24px 0 12px' }}>Events</h2>
        <div className="stubs">
          {filtered.length === 0 ? (
            <p style={{ color: '#625f82', textAlign: 'center' }}>No events match your filters.</p>
          ) : (
            filtered.map((event) => {
              const left = (event.capacity || 0) - (event.registeredCount || 0)
              const price = event.price || 0
              return (
                <button
                  key={event._id || event.id}
                  type="button"
                  className="stub"
                  style={{ '--a': event.colorA || '#c42a55', '--b': event.colorB || '#ffb703' }}
                  onClick={() => setSheetEvent(event)}
                  aria-label={`View ${event.title}`}
                >
                  <div className="stub__date">
                    <div className="stub__day">{new Date(event.date).getDate()}</div>
                    <div className="stub__month">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                    <span className="stub__notches" aria-hidden="true" />
                  </div>
                  <div className="stub__body">
                    <div className="stub__title">{event.title}</div>
                    <div className="stub__venue" aria-hidden="true">📍</div>
                    <div className="stub__venue">{event.location}</div>
                    <div className="stub__price">From KES {price.toLocaleString()}</div>
                    <div className="stub__meter"><div className="stub__meter-fill" /></div>
                    {left < 150 && (
                      <div className={`stub__left ${left < 150 ? 'stub__left--low' : ''}`}>
                        Only {left} left
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {user && user.role === 'organizer' && (
          <p style={{ color: '#625f82', fontSize: 13, marginTop: 16 }}>
            <Link to="/create-event">Create an event</Link>
          </p>
        )}
      </div>
    </div>
  )
}
