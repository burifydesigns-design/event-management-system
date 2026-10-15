import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import { getMyEvents } from '../services/registrationService'
import { cancelRegistration } from '../services/registrationService'

export default function MyEvents() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState([])
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
        const data = await getMyEvents()
        setRegistrations(data.data || data || [])
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
      setRegistrations((prev) => prev.filter((r) => r._id !== cancelId))
      setSuccess('Registration cancelled successfully.')
      setCancelId(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel registration.')
    } finally {
      setCancelling(false)
    }
  }

  const now = new Date()
  const upcoming = registrations.filter((r) => {
    const eventDate = new Date(r.event?.date || r.date)
    return eventDate > now && r.status === 'confirmed'
  })
  const past = registrations.filter((r) => {
    const eventDate = new Date(r.event?.date || r.date)
    return eventDate <= now || r.status === 'attended' || r.status === 'cancelled'
  })
  const cancelled = registrations.filter((r) => r.status === 'cancelled')

  const displayList = activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : cancelled

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
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`tab-btn ${activeTab === 'cancelled' ? 'tab-btn--active' : ''}`}
          >
            Cancelled ({cancelled.length})
          </button>
        </div>

        {displayList.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📋</p>
            <p className="empty-state-title">No {activeTab} events</p>
            <p className="empty-state-text">
              {activeTab === 'upcoming'
                ? "You haven't registered for any upcoming events yet."
                : activeTab === 'past'
                ? 'You have no past events.'
                : 'You have no cancelled registrations.'}
            </p>
            <Link to="/events" className="btn btn-primary">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="registrations-list">
            {displayList.map((reg) => (
              <div key={reg._id} className="registration-card">
                <div className="registration-card-content">
                  <div className="registration-info">
                    <h3 className="registration-event-title">
                      {reg.event?.title || 'Event'}
                    </h3>
                    <div className="registration-meta">
                      <span>📅 {new Date(reg.event?.date || reg.date).toLocaleDateString()}</span>
                      <span>📍 {reg.event?.city || reg.event?.location || ''}</span>
                      <span>🎫 #{reg.ticketNumber}</span>
                      <span>📊 {reg.status}</span>
                    </div>
                  </div>
                  <div className="registration-actions">
                    <Link
                      to={`/my-ticket/${reg._id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Ticket
                    </Link>
                    <Link
                      to={`/events/${reg.event?._id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Event
                    </Link>
                    {reg.status === 'confirmed' && (
                      <button
                        onClick={() => setCancelId(reg._id)}
                        className="btn btn-danger btn-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
