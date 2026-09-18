import QRCode from 'qrcode'

export default function Ticket({ registration, event }) {
  const qrData = JSON.stringify({
    registrationId: registration._id,
    ticketNumber: registration.ticketNumber,
    eventId: event._id,
  })

  const qrCodeUrl = QRCode.toDataURL(qrData, {
    width: 200,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  })

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="ticket">
      <div className="ticket-inner">
        <div className="ticket-left">
          <div className="ticket-header">
            <h2 className="ticket-event-name">{event.title}</h2>
            <span className="ticket-status ticket-status--{registration.status}">
              {registration.status}
            </span>
          </div>

          <div className="ticket-details">
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
              <span className="ticket-detail-value">{registration.attendeeName}</span>
            </div>
            <div className="ticket-detail">
              <span className="ticket-detail-label">Ticket #</span>
              <span className="ticket-detail-value ticket-number">{registration.ticketNumber}</span>
            </div>
          </div>
        </div>

        <div className="ticket-right">
          <div className="ticket-qr">
            <img src={qrCodeUrl} alt="QR Code" className="qr-image" />
            <p className="qr-label">Scan at venue</p>
          </div>
        </div>
      </div>
    </div>
  )
}
