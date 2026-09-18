import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import { getEvent } from '../services/eventService'
import { registerForEvent } from '../services/registrationService'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        const data = await getEvent(id)
        setEvent(data)
      } catch (err) {
        setError('Unable to load event details. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [id])

  const handleRegister = async () => {
    try {
      setRegistering(true)
      await registerForEvent(id)
      setSuccess('Successfully registered for the event!')
      setEvent((prev) => ({
        ...prev,
        registeredCount: (prev.registeredCount || 0) + 1,
      }))
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setRegistering(false)
      setShowConfirm(false)
    }
  }

  if (loading) return <Loading text="Loading event details..." />
  if (error && !event) return <ErrorMessage message={error} />

  if (!event) {
    return (
      <div className="container">
        <div className="empty-state">
          <p className="empty-state-icon">🔍</p>
          <p className="empty-state-title">Event not found</p>
          <p className="empty-state-text">The event you're looking for doesn't exist or has been removed.</p>
          <button onClick={() => navigate('/events')} className="btn btn-primary">
            Browse Events
          </button>
        </div>
      </div>
    )
  }

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const seatsRemaining = event.capacity - (event.registeredCount || 0)
  const isFull = seatsRemaining <= 0
  const isPast = new Date(event.date) < new Date()
  const isOrganizer = user && event.organizer?._id === user._id
  const isAdmin = user?.role === 'admin'

  const registration = event.userRegistration

  return (
    <div className="page-event-details">
      <div className="container">
        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="event-detail">
          <div className="event-detail-image">
            <img
              src={event.image || 'https://via.placeholder.com/800x400?text=Event+Image'}
              alt={event.title}
            />
            <span className="event-detail-badge">{event.category}</span>
          </div>

          <div className="event-detail-content">
            <div className="event-detail-header">
              <div>
                <h1 className="event-detail-title">{event.title}</h1>
                <p className="event-detail-organizer">
                  by {event.organizer?.name || 'Unknown Organizer'}
                </p>
              </div>
              <div className="event-detail-price">
                {event.price ? `$${event.price}` : 'Free'}
              </div>
            </div>

            <div className="event-detail-info">
              <div className="info-item">
                <span className="info-icon">📅</span>
                <div>
                  <p className="info-label">Date</p>
                  <p className="info-value">{eventDate}</p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">🕐</span>
                <div>
                  <p className="info-label">Time</p>
                  <p className="info-value">{event.time || 'TBD'}</p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">📍</span>
                <div>
                  <p className="info-label">Location</p>
                  <p className="info-value">{event.location}</p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">🏙️</span>
                <div>
                  <p className="info-label">City</p>
                  <p className="info-value">{event.city}</p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">👥</span>
                <div>
                  <p className="info-label">Capacity</p>
                  <p className="info-value">
                    {event.registeredCount || 0} / {event.capacity}
                  </p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">💺</span>
                <div>
                  <p className="info-label">Seats Remaining</p>
                  <p className={`info-value ${isFull ? 'text-danger' : ''}`}>
                    {isFull ? 'Sold Out' : `${seatsRemaining} available`}
                  </p>
                </div>
              </div>
            </div>

            <div className="event-detail-description">
              <h3>About This Event</h3>
              <p>{event.description}</p>
            </div>

            <div className="event-detail-actions">
              {registration ? (
                <Link to={`/my-ticket/${registration._id}`} className="btn btn-primary btn-lg">
                  View Ticket
                </Link>
              ) : !user ? (
                <Link to="/login" className="btn btn-primary btn-lg">
                  Login to Register
                </Link>
              ) : isPast ? (
                <button className="btn btn-secondary btn-lg" disabled>
                  Event Ended
                </button>
              ) : isFull ? (
                <button className="btn btn-secondary btn-lg" disabled>
                  Event Full
                </button>
              ) : isOrganizer || isAdmin ? (
                <span className="text-muted">You are the organizer</span>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={registering}
                  className="btn btn-primary btn-lg"
                >
                  {registering ? 'Registering...' : 'Register Now'}
                </button>
              )}

              {(isOrganizer || isAdmin) && (
                <Link to={`/edit-event/${event._id}`} className="btn btn-outline btn-lg">
                  Edit Event
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        visible={showConfirm}
        message={`Register for "${event.title}"?`}
        onConfirm={handleRegister}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
