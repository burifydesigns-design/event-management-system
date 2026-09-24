import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getEvent } from '../services/eventService'
import { registerForEvent } from '../services/registrationService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import '../styles/event-details.css'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [registrationData, setRegistrationData] = useState(null)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        setError(null)
        setRegistrationMessage('')
        setRegistrationData(null)
        const data = await getEvent(id)
        setEvent(data)
      } catch (err) {
        if (err.response?.status === 404) {
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

  const handleRegister = async () => {
    try {
      setRegistering(true)
      setRegistrationMessage('')
      setRegistrationData(null)
      const response = await registerForEvent(event._id)
      setRegistrationData(response.registration)
      let message = response.message || 'Successfully registered for the event.'
      if (response.emailSent === false) {
        message += ' (Confirmation email could not be sent - please check your spam folder or contact support)'
      } else if (response.emailSent === true) {
        message += ' A confirmation email has been sent to your email address.'
      }
      setRegistrationMessage(message)
    } catch (error) {
      console.error(error)
      if (error.response?.status === 401) {
        navigate('/login')
        return
      }
      setRegistrationMessage(error.response?.data?.message || 'Registration failed.')
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="page-event-details">
        <div className="container">
          <Loading text="Loading event..." />
        </div>
      </div>
    )
  }

  if (error === 'not_found' || !event) {
    return (
      <div className="page-event-details">
        <div className="container">
          <div className="event-not-found">
            <p className="event-not-found-icon">🔍</p>
            <h1 className="event-not-found-title">Event Not Found</h1>
            <p className="event-not-found-text">
              The event you're looking for does not exist.
            </p>
            <Link to="/events" className="btn btn-primary">
              Back to Events
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-event-details">
        <div className="container">
          <ErrorMessage message={error} />
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

  const isSuccess = registrationMessage.toLowerCase().includes('successfully') || registrationMessage.toLowerCase().includes('success')

  return (
    <div className="page-event-details">
      <div className="container">
        <div className="event-detail">
          <div className="event-detail-image">
            <img
              src={event.image || 'https://via.placeholder.com/800x400?text=No+Image'}
              alt={event.title}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x400?text=No+Image'
              }}
            />
            <span className="event-detail-badge">{event.category}</span>
          </div>

          <div className="event-detail-content">
            <div className="event-detail-layout">
              <div className="event-detail-main">
                <div className="event-detail-header">
                  <div>
                    <h1 className="event-detail-title">{event.title}</h1>
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
                </div>

                <div className="event-detail-description">
                  <h3>About This Event</h3>
                  <p>{event.description}</p>
                </div>
              </div>

              <div className="event-detail-sidebar">
                <div className="event-detail-card">
                  <div className="event-detail-card-header">
                    <h3>Registration</h3>
                    <div className="event-detail-price">
                      {event.price === 0 ? 'Free' : `$${event.price}`}
                    </div>
                  </div>

                  <div className="event-detail-stats">
                    <div className="event-detail-stat">
                      <span className="event-detail-stat-label">Capacity</span>
                      <span className="event-detail-stat-value">{event.capacity}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-lg"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    {registering ? 'Registering...' : 'Register for Event'}
                  </button>

                  {registrationMessage && (
                    <div className={`registration-message ${isSuccess ? 'registration-message--success' : 'registration-message--error'}`}>
                      {registrationMessage}
                    </div>
                  )}

                  {registrationData && isSuccess && (
                    <div className="registration-confirmation">
                      <h4>Registration Details</h4>
                      <p><strong>Ticket Number:</strong> {registrationData.ticketNumber}</p>
                      <p><strong>Status:</strong> Confirmed</p>
                      <div className="registration-confirmation-actions">
                        <Link to="/my-events" className="btn btn-outline btn-sm">View My Events</Link>
                        <Link to={`/my-ticket/${registrationData._id}`} className="btn btn-primary btn-sm">View Ticket</Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="event-detail-back">
              <Link to="/events" className="back-link">
                ← Back to Events
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}