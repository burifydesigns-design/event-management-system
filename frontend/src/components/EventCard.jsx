import { Link } from 'react-router-dom'

export default function EventCard({ event }) {
  const imageUrl = event.image || 'https://via.placeholder.com/400x250?text=No+Image'
  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const seatsRemaining = event.capacity - event.registeredCount
  const isFull = seatsRemaining <= 0

  return (
    <div className="event-card">
      <div className="event-card-image">
        <img src={imageUrl} alt={event.title} loading="lazy" />
        <span className="event-card-badge">{event.category}</span>
        {isFull && <span className="event-card-full">Full</span>}
      </div>
      <div className="event-card-content">
        <h3 className="event-card-title">{event.title}</h3>
        <div className="event-card-meta">
          <span className="event-card-date">📅 {eventDate}</span>
          <span className="event-card-time">🕐 {event.time || 'TBD'}</span>
        </div>
        <div className="event-card-location">
          <span>📍 {event.city || event.location}</span>
        </div>
        <div className="event-card-footer">
          <div className="event-card-price">
            {event.price ? `$${event.price}` : 'Free'}
          </div>
          <div className="event-card-seats">
            {isFull ? (
              <span className="seats-full">Event Full</span>
            ) : (
              <span className={seatsRemaining <= 10 ? 'seats-low' : 'seats-available'}>
                {seatsRemaining} seats left
              </span>
            )}
          </div>
        </div>
        <Link to={`/events/${event._id}`} className="btn btn-primary btn-block">
          View Event
        </Link>
      </div>
    </div>
  )
}
