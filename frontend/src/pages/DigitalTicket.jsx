import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getTicket } from '../services/registrationService'
import Ticket from '../components/Ticket'

export default function DigitalTicket() {
  const { registrationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ticketData = await getTicket(registrationId)
        setTicket(ticketData.ticket)
      } catch (err) {
        if (err.response?.status === 403) {
          setError('You are not authorized to view this ticket.')
        } else if (err.response?.status === 404) {
          setError('Ticket not found.')
        } else {
          setError('Unable to load ticket. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [registrationId])

  if (loading) return <Loading text="Loading ticket..." />
  if (error) return <ErrorMessage message={error} onClose={() => navigate('/my-events')} />

  if (!ticket) {
    return (
      <div className="container">
        <div className="empty-state">
          <p className="empty-state-icon">🎫</p>
          <p className="empty-state-title">Ticket not found</p>
          <p className="empty-state-text">The ticket you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/my-events')} className="btn btn-primary mt-2">
            Back to My Events
          </button>
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

        <Ticket ticket={ticket} />

        <div className="ticket-actions">
          <button
            onClick={() => window.print()}
            className="btn btn-primary"
          >
            Print Ticket
          </button>
          <button
            onClick={() => navigate('/my-events')}
            className="btn btn-outline"
          >
            Back to My Events
          </button>
        </div>
      </div>
    </div>
  )
}
