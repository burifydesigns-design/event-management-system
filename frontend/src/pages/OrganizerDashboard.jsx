import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getOrganizerAnalytics } from '../services/ticketService'
import { getEvents } from '../services/eventService'
import { deleteEvent } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'

const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function nearest50(n) {
  return Math.max(0, Math.round(Number(n) / 50) * 50)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Animated counter: counts 0 -> value over 700ms unless reduced motion.
function Counter({ value }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (REDUCED || value === display) { setDisplay(value); return }
    const start = performance.now()
    const duration = 700
    let frame
    function step(now) {
      const elapsed = now - start
      const p = Math.min(elapsed / duration, 1)
      // ease out
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * value))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, display])
  return <span className="counter-number">{display}</span>
}

// Small inline sparkline (120x36) in --ac.
function Sparkline({ points }) {
  const width = 120
  const height = 36
  const max = points.length ? Math.max(...points) : 1
  const step = width / Math.max(points.length - 1, 1)
  const d = points
    .map((v, i) => {
      const y = height - (v / max) * (height - 6)
      return `${i * step},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} fill="none" role="img" aria-label="Check-in trend">
      <polyline points={d} stroke="var(--ac)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function OrganizerDashboard() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [deleted, setDeleted] = useState({})
  const [toast, setToast] = useState(null) // { id, title, timer }
  const [search, setSearch] = useState('')
  const timers = useRef({})

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [analyticsRes, eventsRes] = await Promise.all([
        getOrganizerAnalytics(),
        getEvents(),
      ])
      setAnalytics(analyticsRes)
      setEvents(eventsRes.events || eventsRes.data || [])
    } catch (err) {
      setError('Unable to load organizer dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Dismiss toast after it expires
  useEffect(() => {
    if (!toast) return
    const id = toast.id
    return () => {
      if (timers.current[id]) clearTimeout(timers.current[id])
    }
  }, [toast])

  if (loading) return <Loading text="Loading organizer dashboard..." />
  if (error) return <ErrorMessage message={error} />

  const capacityUtilization = analytics?.capacityUtilization || []
  const registrationsOverTime = analytics?.registrationsOverTime || []
  const totalConfirmed = analytics?.totalConfirmed || 0
  const totalCheckedIn = analytics?.totalCheckedIn || 0

  // Sold per event by title (from analytics), matched to event list for date/price.
  const soldByTitle = {}
  capacityUtilization.forEach((e) => { soldByTitle[String(e.title)] = { sold: e.registered || 0, capacity: e.capacity || 0 } })

  let revenue = 0
  const visibleEvents = events.filter((e) => {
    const text = `${e.title} ${e.city} ${e.location}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })
  visibleEvents.forEach((e) => {
    const s = soldByTitle[String(e.title)]
    if (s) revenue += s.sold * (e.price || 0)
  })

  const checkinPoints = registrationsOverTime.slice(-12).map((d) => d.count)

  // ----- Delete with undo -----
  const handleDelete = (event) => {
    const id = event._id || event.id
    setDeleted((prev) => ({ ...prev, [id]: event }))
    setEvents((prev) => prev.filter((e) => String(e._id || e.id) !== String(id)))
    setSuccess(null)
    const timer = setTimeout(() => {
      deleteEvent(id)
        .then(() => {
          setDeleted((prev) => { const { [id]: _removed, ...rest } = prev; return rest })
          setToast(null)
        })
        .catch((err) => {
          setEvents((prev) => [...prev, event])
          setDeleted((prev) => { const { [id]: _removed, ...rest } = prev; return rest })
          setToast(null)
          setError(err.response?.data?.message || 'Failed to delete event.')
        })
    }, 4000)
    timers.current[id] = timer
    setToast({ id, title: event.title })
  }

  const handleUndo = (id) => {
    const event = deleted[id]
    if (!event) return
    if (timers.current[id]) clearTimeout(timers.current[id])
    setEvents((prev) => [event, ...prev])
    setDeleted((prev) => { const { [id]: _removed, ...rest } = prev; return rest })
    setToast(null)
    setSuccess('Event restored.')
  }

  const statusPill = (event) => {
    const s = soldByTitle[String(event.title)]
    const sold = s ? s.sold : 0
    const capacity = s ? s.capacity : (event.capacity || 0)
    const pct = capacity > 0 ? sold / capacity : 0
    return pct > 0.9 ? (
      <span className="pill pill--bad">Almost full</span>
    ) : (
      <span className="pill pill--ok">On sale</span>
    )
  }

  const soldText = (event) => {
    const s = soldByTitle[String(event.title)]
    const sold = s ? s.sold : 0
    const capacity = s ? s.capacity : (event.capacity || 0)
    return `Sold ${sold} of ${capacity}`
  }

  return (
    <div className="page page--organizer">
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast__msg">Event deleted</span>
          <div className="toast__actions">
            <button type="button" className="btn btn--ghost" onClick={() => handleUndo(toast.id)}>Undo</button>
          </div>
        </div>
      )}
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div>
            <h1>Overview</h1>
            <p style={{ color: 'var(--mu)', fontSize: 14 }}>Your events at a glance.</p>
          </div>
          <Link to="/create-event" className="btn btn--primary">New event</Link>
        </div>

        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="summary-list">
          <div className="summary-row">
            <Counter value={totalConfirmed} />
            <span className="summary-label">tickets sold</span>
          </div>
          <div className="summary-row">
            <span className="summary-value">KES {revenue.toLocaleString()}</span>
            <span className="summary-label">revenue</span>
          </div>
          <div className="summary-row">
            <Counter value={totalCheckedIn} />
            <span className="summary-label">checked in</span>
            <span className="summary-sparkline"><Sparkline points={checkinPoints} /></span>
          </div>
        </div>

        <div className="section">
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="visually-hidden">Search events</label>
            <input className="input" type="search" placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '44%' }}>Event</th>
                  <th style={{ width: '26%' }}>Date</th>
                  <th style={{ width: '20%' }}>Sold</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '10%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: 'var(--mu)', textAlign: 'center', padding: 20 }}>No events found.</td></tr>
                ) : (
                  visibleEvents.map((event) => {
                    const id = event._id || event.id
                    const isDeleted = !!deleted[id]
                    if (isDeleted) return null
                    const s = soldByTitle[String(event.title)]
                    const sold = s ? s.sold : 0
                    const capacity = s ? s.capacity : (event.capacity || 0)
                    const pct = capacity > 0 ? sold / capacity : 0
                    return (
                      <tr key={id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{event.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--mu)' }}>{fmtDate(event.date)}</div>
                        </td>
                        <td>{soldText(event)}</td>
                        <td>{pct > 0.9 ? <span className="pill pill--bad">Almost full</span> : <span className="pill pill--ok">On sale</span>}</td>
                        <td>
                          <button type="button" className="btn btn--icon" onClick={() => handleDelete(event)} aria-label={`Delete ${event.title}`} title="Delete">✕</button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
