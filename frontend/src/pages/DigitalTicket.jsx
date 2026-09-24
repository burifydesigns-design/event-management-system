import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getRegistration } from '../services/registrationService'
import Ticket from '../components/Ticket'

export default function DigitalTicket() {
  const { registrationId } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getRegistration(registrationId)
        setData(res)
      } catch (err) {
        setError('Unable to load ticket. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [registrationId])

  if (loading) return <Loading text="Loading ticket..." />
  if (error) return <ErrorMessage message={error} />

  if (!data || !data.registration || !data.registration.event) {
    return (
      <div className="container">
        <div className="empty-state">
          <p className="empty-state-icon">🎫</p>
          <p className="empty-state-title">Ticket not found</p>
          <p className="empty-state-text">The ticket you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const { registration, ticket } = data
  const event = registration.event
  const attendeeName = registration.user?.name || user?.name || 'Attendee'

  return (
    <div className="page-ticket">
      <div className="container">
        <div className="ticket-page-header">
          <h1 className="page-title">Your Ticket</h1>
          <p className="page-subtitle">Present this ticket at the venue</p>
        </div>

        <Ticket
          registration={{
            ...registration,
            attendeeName,
            ticketNumber: registration.ticketNumber,
            status: registration.status,
          }}
          event={event}
          qrToken={ticket?.qrToken}
        />

        <div className="ticket-actions">
          <button
            onClick={() => window.print()}
            className="btn btn-primary"
          >
            Print Ticket
          </button>
        </div>
      </div>
    </div>
  )
}
