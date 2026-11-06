import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getEvent } from '../services/eventService'
import TicketSheet from '../components/TicketSheet'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function EventDetails() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getEvent(id)
        setEvent(data)
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setError('not_found')
        } else {
          setError('Failed to load event. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [id])

  if (loading) {
    return <Loading text="Loading event..." />
  }
  if (error === 'not_found' || !event) {
    return (
      <div className="page page--event-details">
        <div className="container">
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--mu)' }}>
            <p style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Event not found</p>
            <p>The event you're looking for does not exist.</p>
            <Link to="/events" className="btn btn--primary" style={{ marginTop: 12 }}>Back to events</Link>
          </div>
        </div>
      </div>
    )
  }
  if (error) {
    return <ErrorMessage message={error} />
  }

  const colorA = event.colorA || '#c42a55'
  const colorB = event.colorB || '#ffb703'
  const eventStyle = { '--a': colorA, '--b': colorB }

  return (
    <div className="page page--event-details">
      {sheetOpen && <TicketSheet event={event} onClose={() => setSheetOpen(false)} />}
      <div className="container">
        <div className="poster" style={eventStyle}>
          <div className="poster__art" aria-hidden="true" />
          <div className="poster__body">
            <span className="poster__kicker">{event.category}</span>
            <div className="poster__day" aria-label={fmtDate(event.date)}>{new Date(event.date).getDate()}</div>
            <h1 className="poster__title">{event.title}</h1>
            <p className="poster__meta">{fmtDate(event.date)} at {event.location}</p>
            <button type="button" className="btn btn--primary" onClick={() => setSheetOpen(true)} style={{ marginTop: 10, alignSelf: 'start' }}>Get tickets</button>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>About this event</h2>
          <p style={{ color: 'var(--mu)', lineHeight: 1.6, marginBottom: 14 }}>{event.description}</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--mu)', fontSize: 14 }}>
            <span><strong>Date:</strong> {fmtDate(event.date)}</span>
            <span><strong>Time:</strong> {event.time || 'TBD'}</span>
            <span><strong>Venue:</strong> {event.location}</span>
            <span><strong>City:</strong> {event.city}</span>
            <span><strong>Capacity:</strong> {event.capacity}</span>
            <span><strong>Price:</strong> {event.price === 0 ? 'Free' : `KES ${event.price.toLocaleString()}`}</span>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link to="/events" className="btn btn--ghost">Back to events</Link>
        </div>
      </div>
    </div>
  )
}
