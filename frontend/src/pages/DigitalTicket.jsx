import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getRegistration } from '../services/registrationService'
import { getEvent } from '../services/eventService'
import Ticket from '../components/Ticket'

export default function DigitalTicket() {
  const { registrationId } = useParams()
  const { user } = useAuth()
  const [registration, setRegistration] = useState(null)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const regData = await getRegistration(registrationId)
        setRegistration(regData)

        if (regData.event?._id) {
          const eventData = await getEvent(regData.event._id)
          setEvent(eventData)
        }
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

  if (!registration || !event) {
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

  return (
    <div className="page-ticket">
      <div className="container">
        <div className="ticket-page-header">
          <h1 className="page-title">Your Ticket</h1>
          <p className="page-subtitle">Present this ticket at the venue</p>
        </div>

        <Ticket registration={registration} event={event} />

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
