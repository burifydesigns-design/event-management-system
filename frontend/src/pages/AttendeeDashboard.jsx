import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getMyEvents } from '../services/registrationService'

export default function AttendeeDashboard() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        setLoading(true)
        const data = await getMyEvents()
        const regs = data.data || data || []
        setRegistrations(regs)
      } catch (err) {
        setError('Unable to load your dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchRegistrations()
  }, [])

  if (loading) return <Loading text="Loading dashboard..." />
  if (error) return <ErrorMessage message={error} />

  const now = new Date()
  const upcomingRegs = registrations.filter((r) => {
    const eventDate = new Date(r.event?.date || r.date)
    return eventDate > now && r.status === 'confirmed'
  })

  return (
    <div className="page-dashboard">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Welcome, {user?.name}</h1>
          <p className="page-subtitle">Your Attendee Dashboard</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-card--primary">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-value">{registrations.length}</p>
              <p className="stat-label">Total Registrations</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-value">{upcomingRegs.length}</p>
              <p className="stat-label">Upcoming Events</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="dashboard-section-title">My Upcoming Events</h2>
              <Link to="/my-events" className="btn btn-outline btn-sm">View All</Link>
            </div>
            {upcomingRegs.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No upcoming events</p>
                <Link to="/events" className="btn btn-primary btn-sm">Browse Events</Link>
              </div>
            ) : (
              <div className="events-list">
                {upcomingRegs.slice(0, 3).map((reg) => (
                  <div key={reg._id} className="event-item">
                    <div className="event-item-info">
                      <h4>{reg.event?.title || 'Event'}</h4>
                      <p>📅 {new Date(reg.event?.date || reg.date).toLocaleDateString()} • 📍 {reg.event?.city || reg.event?.location}</p>
                    </div>
                    <div className="event-item-actions">
                      <Link to={/my-ticket/} className="btn btn-primary btn-sm">View Ticket</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-section">
            <h2 className="dashboard-section-title">Quick Actions</h2>
            <div className="dashboard-actions">
              <Link to="/events" className="dashboard-action-card">
                <span className="dashboard-action-icon">🔍</span>
                <span>Browse Events</span>
              </Link>
              <Link to="/my-events" className="dashboard-action-card">
                <span className="dashboard-action-icon">🎫</span>
                <span>My Events</span>
              </Link>
              <Link to="/profile" className="dashboard-action-card">
                <span className="dashboard-action-icon">👤</span>
                <span>My Profile</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
