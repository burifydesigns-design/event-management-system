export default function Ticket({ ticket }) {
  const event = ticket.event
  const attendee = ticket.attendee

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const issuedAt = ticket.registeredAt ? new Date(ticket.registeredAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'N/A'

  return (
    <div className="ticket">
      <div className="ticket-inner">
        <div className="ticket-left">
          <div className="ticket-header">
            <h2 className="ticket-event-name">{event.title}</h2>
            <span className="ticket-status ticket-status--{ticket.status}">
              {ticket.status}
            </span>
          </div>

          {event.image && (
            <div className="ticket-event-image">
              <img src={event.image} alt={event.title} loading="lazy" />
            </div>
          )}

          <div className="ticket-details">
            {event.status === 'cancelled' && (
              <p className="alert alert-error" role="status">
                This event was cancelled. This ticket is kept for your records and is not valid for entry.
              </p>
            )}
            <div className="ticket-detail">
              <span className="ticket-detail-label">Date</span>
              <span className="ticket-detail-value">{eventDate}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Time</span>
              <span className="ticket-detail-value">{event.time || 'TBD'}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Venue</span>
              <span className="ticket-detail-value">{event.location}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">City</span>
              <span className="ticket-detail-value">{event.city}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Attendee</span>
              <span className="ticket-detail-value">{attendee.name}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Email</span>
              <span className="ticket-detail-value">{attendee.email}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Ticket #</span>
              <span className="ticket-detail-value ticket-number">{ticket.ticketNumber}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Issued</span>
              <span className="ticket-detail-value">{issuedAt}</span>
            </div>
          </div>
        </div>

        <div className="ticket-right">
          <div className="ticket-summary">
            <h3>Ticket Details</h3>
            <div className="ticket-summary-item">
              <span className="ticket-summary-label">Ticket #</span>
              <span className="ticket-summary-value ticket-number">{ticket.ticketNumber}</span>
            </div>
            <div className="ticket-summary-item">
              <span className="ticket-summary-label">Status</span>
              <span className="ticket-summary-value ticket-status ticket-status--{ticket.status}">{ticket.status}</span>
            </div>
            <div className="ticket-summary-item">
              <span className="ticket-summary-label">Event</span>
              <span className="ticket-summary-value">{event.title}</span>
            </div>
            <div className="ticket-summary-item">
              <span className="ticket-summary-label">Date</span>
              <span className="ticket-summary-value">{eventDate}</span>
            </div>
          </div>

          {ticket.qrCode && event.status !== 'cancelled' && (
            <div className="ticket-qr-section">
              <div className="ticket-qr-code">
                <img 
                  src={ticket.qrCode} 
                  alt="QR code for this event ticket" 
                  className="qr-code-image"
                />
              </div>
              <p className="ticket-qr-caption">Present this QR code at the venue for check-in</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
