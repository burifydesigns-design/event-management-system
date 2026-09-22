import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import { getMyEvents } from '../services/registrationService'
import { cancelRegistration } from '../services/registrationService'
import '../styles/my-events.css'

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return 'TBD'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RegistrationCard({ reg, onCancel }) {
  const event = reg.event
  const imageUrl = event?.image || ''
  const eventTitle = event?.title || 'Event no longer available'
  const category = event?.category || ''
  const dateTime = event ? formatDateTime(event.date, event.time) : 'Date unavailable'
  const location = event ? [event.location, event.city].filter(Boolean).join(', ') : 'Location unavailable'
  const ticketNumber = reg.ticketNumber || '—'
  const status = reg.status || 'confirmed'
  const statusClass = `registration-status--${status.replace('-', '')}`

  const canCancel = status === 'confirmed' && event && new Date(`${event.date}T${event.time || '00:00'}`) > new Date()

  return (
    <div className="registration-card">
      {imageUrl && (
        <div className="registration-card-image">
          <img src={imageUrl} alt={eventTitle} loading="lazy" />
        </div>
      )}
      <div className="registration-card-body">
        <div className="registration-card-header">
          <div className="registration-card-title-group">
            <h3 className="registration-card-title">{eventTitle}</h3>
            {category && <span className="registration-card-category">{category}</span>}
          </div>
          <span className={`registration-card-status ${statusClass}`}>{status}</span>
        </div>

        <div className="registration-card-meta">
          <span className="registration-card-meta-item">📅 {dateTime}</span>
          <span className="registration-card-meta-item">📍 {location}</span>
          <span className="registration-card-meta-item">🎫 #{ticketNumber}</span>
        </div>

        <div className="registration-card-actions">
          <Link to={`/events/${event?._id || ''}`} className="btn btn-outline btn-sm">
            View Event
          </Link>
          <Link to={`/my-ticket/${reg._id}`} className="btn btn-outline btn-sm">
            View Ticket
          </Link>
          {canCancel && (
            <button onClick={() => onCancel(reg._id)} className="btn btn-danger btn-sm" disabled={reg._cancelling}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyEvents() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState({ upcoming: [], past: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [activeTab, setActiveTab] = useState('upcoming')

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getMyEvents()
        setRegistrations({
          upcoming: data.upcoming || [],
          past: data.past || [],
        })
      } catch (err) {
        setError('Unable to load your events. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchRegistrations()
  }, [])

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      setCancelling(true)
      await cancelRegistration(cancelId)
      setRegistrations((prev) => ({
        upcoming: prev.upcoming.filter((r) => r._id !== cancelId),
        past: prev.past.filter((r) => r._id !== cancelId),
      }))
      setSuccess('Registration cancelled successfully.')
      setCancelId(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel registration.')
    } finally {
      setCancelling(false)
    }
  }

  const upcoming = registrations.upcoming
  const past = registrations.past
  const displayList = activeTab === 'upcoming' ? upcoming : past

  if (loading) return <Loading text="Loading your events..." />

  return (
    <div className="page-my-events">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">My Events</h1>
          <p className="page-subtitle">Manage your event registrations</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="tabs">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`tab-btn ${activeTab === 'upcoming' ? 'tab-btn--active' : ''}`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`tab-btn ${activeTab === 'past' ? 'tab-btn--active' : ''}`}
          >
            Past ({past.length})
          </button>
        </div>

        {displayList.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📋</p>
            <p className="empty-state-title">No {activeTab} events</p>
            <p className="empty-state-text">
              {activeTab === 'upcoming'
                ? "You haven't registered for any upcoming events yet."
                : 'You have no past events.'}
            </p>
            <Link to="/events" className="btn btn-primary">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="registrations-list">
            {displayList.map((reg) => (
              <RegistrationCard key={reg._id} reg={reg} onCancel={setCancelId} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        visible={!!cancelId}
        message="Are you sure you want to cancel this registration?"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  )
}
