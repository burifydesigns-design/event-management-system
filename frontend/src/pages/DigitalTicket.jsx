import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getRegistration } from '../services/registrationService'
import { getEvent } from '../services/eventService'
import { getTicketQR } from '../services/ticketService'

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Client-side QR fallback (SVG, no image) using qrcode-generator 1.4.4 from cdnjs.
function makeQRSvg(text) {
  if (typeof window === 'undefined' || !window.qrcode) return null
  try {
    const qr = window.qrcode(4, 'L')
    qr.addData(text || '')
    qr.make()
    return qr.createSvgTag(6, 0)
  } catch {
    return null
  }
}

export default function DigitalTicket() {
  const { registrationId } = useParams()
  const { user } = useAuth()
  const [registration, setRegistration] = useState(null)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [qrSvg, setQrSvg] = useState(null)
  const [qrUrl, setQrUrl] = useState(null)
  const [boost, setBoost] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const regData = await getRegistration(registrationId)
        setRegistration(regData)
        if (regData.event?._id) {
          const eventData = await getEvent(regData.event._id)
          setEvent(eventData)
        }
        // Existing QR generation endpoint; falls back to client-side SVG if unavailable.
        try {
          const { data } = await getTicketQR(registrationId)
          if (data.qrCode) {
            setQrUrl(data.qrCode)
          } else {
            setQrSvg(makeQRSvg(regData.ticketNumber || registrationId))
          }
        } catch {
          setQrSvg(makeQRSvg(regData.ticketNumber || registrationId))
        }
      } catch (err) {
        setError('Unable to load ticket. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [registrationId])

  useEffect(() => {
    if (boost) document.body.classList.add('ticket--bright')
    else document.body.classList.remove('ticket--bright')
    return () => document.body.classList.remove('ticket--bright')
  }, [boost])

  if (loading) return <Loading text="Loading ticket..." />
  if (error) return <ErrorMessage message={error} />

  if (!registration || !event) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--mu)' }}>
          <p style={{ fontSize: 36, marginBottom: 8, fontWeight: 800 }}>🎫</p>
          <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Ticket not found</p>
          <p>The ticket you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const colorA = event.colorA || '#0b6b4f'
  const colorB = event.colorB || '#f2b01e'
  const ticketNumber = registration.ticketNumber || ''
  const admits = 1
  const eventStyle = { '--a': colorA, '--b': colorB }
  const qrContent = qrUrl ? (
    <img src={qrUrl} alt="QR code" className="qr-img" />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: qrSvg || '' }} />
  )

  return (
    <div className="page page--ticket">
      <div className="container">
        <div className="ticket" style={eventStyle}>
          <div className="ticket__top">
            <div className="ticket__body">
              <span className="ticket__tier">{registration.ticketType?.name || 'Standard'}</span>
              <h2 className="ticket__title">{event.title}</h2>
              <p className="ticket__meta">
                {fmtDate(event.date)} • {fmtTime(event.time)} • {event.location}, {event.city}
              </p>
              <div className="ticket__day" aria-label={fmtDate(event.date)}>{new Date(event.date).getDate()}</div>
            </div>
          </div>
          <div className="ticket__perf">
            <span className="ticket__notch ticket__notch--left" aria-hidden="true" />
            <span className="ticket__notch ticket__notch--right" aria-hidden="true" />
          </div>
          <div className="ticket__qr-wrap">
            <div className={`ticket__qr ${boost ? 'bright-halo' : ''}`} ref={qrRef}>
              {qrContent}
            </div>
            <div className="ticket__code" style={{ letterSpacing: '0.06em' }}>{ticketNumber}</div>
          </div>
          <div className="ticket__actions">
            <button type="button" className="btn" onClick={() => setBoost((b) => !b)} aria-pressed={boost}>
              Boost brightness
            </button>
            <button type="button" className="btn btn--primary" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
