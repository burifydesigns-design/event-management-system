import { useParams, Link } from 'react-router-dom'
import eventsData from '../data/events'
import '../styles/event-details.css'

export default function EventDetails() {
  const { id } = useParams()
  const event = eventsData.find((e) => String(e.id) === String(id))

  if (!event) {
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

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const registered = event.registered ?? 0
  const seatsLeft = event.capacity - registered
  const isFull = seatsLeft <= 0

  return (
    <div className="page-event-details">
      <div className="container">
        <div className="event-detail">
          <div className="event-detail-image">
            <img
              src={event.image}
              alt={event.title}
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
                    <div className="event-detail-stat">
                      <span className="event-detail-stat-label">Registered</span>
                      <span className="event-detail-stat-value">{registered}</span>
                    </div>
                    <div className="event-detail-stat">
                      <span className="event-detail-stat-label">Seats Left</span>
                      <span className={`event-detail-stat-value ${isFull ? 'text-danger' : ''}`}>
                        {seatsLeft}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-lg"
                    disabled={isFull}
                  >
                    {isFull ? 'Event Full' : 'Register for Event'}
                  </button>
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
