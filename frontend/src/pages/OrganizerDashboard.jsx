import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getAllEvents } from '../services/adminService'

export default function OrganizerDashboard() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const data = await getAllEvents()
        const allEvents = data.data || data.events || data || []
        setEvents(allEvents)
      } catch (err) {
        setError('Unable to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  if (loading) return <Loading text="Loading dashboard..." />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="page-dashboard">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Organizer Dashboard</h1>
          <p className="page-subtitle">Manage your events</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-card--primary">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-value">{events.length}</p>
              <p className="stat-label">Total Events</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="dashboard-section-title">My Events</h2>
              <Link to="/create-event" className="btn btn-primary btn-sm">Create Event</Link>
            </div>
            {events.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No events yet</p>
                <Link to="/create-event" className="btn btn-primary btn-sm">Create Your First Event</Link>
              </div>
            ) : (
              <div className="events-list">
                {events.slice(0, 5).map((event) => (
                  <div key={event._id} className="event-item">
                    <div className="event-item-info">
                      <h4>{event.title}</h4>
                      <p>📅 {new Date(event.date).toLocaleDateString()} • 📊 {event.status}</p>
                    </div>
                    <div className="event-item-actions">
                      <Link to={`/edit-event/${event._id}`} className="btn btn-outline btn-sm">Edit</Link>
                      <Link to="/admin/attendees" className="btn btn-outline btn-sm">Attendees</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-section">
            <h2 className="dashboard-section-title">Quick Actions</h2>
            <div className="dashboard-actions">
              <Link to="/create-event" className="dashboard-action-card">
                <span className="dashboard-action-icon">➕</span>
                <span>Create Event</span>
              </Link>
              <Link to="/admin/events" className="dashboard-action-card">
                <span className="dashboard-action-icon">📅</span>
                <span>Manage Events</span>
              </Link>
              <Link to="/admin/attendees" className="dashboard-action-card">
                <span className="dashboard-action-icon">👥</span>
                <span>Attendees</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
