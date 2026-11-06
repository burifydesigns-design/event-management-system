import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCoordinatorEvents, getCoordinatorPerformance, getScanHistory } from '../services/ticketService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

export default function CoordinatorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [performance, setPerformance] = useState([])
  const [recentScans, setRecentScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('overview')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [eventsRes, perfRes, historyRes] = await Promise.all([
        getCoordinatorEvents(),
        getCoordinatorPerformance(),
        getScanHistory({ limit: 10 }),
      ])
      setEvents(eventsRes.data || [])
      setPerformance(perfRes.performance || [])
      setRecentScans((historyRes.data || []).map((log) => ({
        ...log,
        scannedAt: log.scannedAt || log.createdAt,
      })))
    } catch (err) {
      setError('Unable to load coordinator dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  const totalScans = performance.reduce((sum, p) => sum + p.totalScans, 0)
  const validScans = performance.reduce((sum, p) => sum + p.validScans, 0)
  const failedScans = performance.reduce((sum, p) => sum + p.failedScans, 0)
  const myEvent = events[0]

  if (loading) return <Loading text="Loading coordinator dashboard..." />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="page-dashboard page-dashboard--coordinator">
      <div className="container">
        <div className="page-header">
          <div className="header-content">
            <h1 className="page-title">Coordinator Control Center</h1>
            <p className="page-subtitle">Assigned events and check-in scanner</p>
          </div>
          <div className="header-actions">
            <Link to="/scanner" className="btn btn-primary btn-lg">
              📷 Open Scanner
            </Link>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-card--primary">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <p className="stat-value">{events.length}</p>
              <p className="stat-label">Assigned Events</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <p className="stat-value">{validScans}</p>
              <p className="stat-label">Valid Check-ins</p>
            </div>
          </div>
          <div className="stat-card stat-card--danger">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <p className="stat-value">{failedScans}</p>
              <p className="stat-label">Failed Scans</p>
            </div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-icon">📷</div>
            <div className="stat-content">
              <p className="stat-value">{totalScans}</p>
              <p className="stat-label">Total Scans</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section wide">
            <div className="section-header">
              <h2 className="section-title">My Assigned Events</h2>
            </div>
            {events.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-icon">📭</p>
                <p className="empty-state-title">No events assigned</p>
                <p className="empty-state-text">You have not been assigned to any events yet. Contact an administrator.</p>
              </div>
            ) : (
              <div className="events-list">
                {events.map((event) => (
                  <div key={event.id} className="event-item">
                    <div className="event-item-info">
                      <h4>{event.title}</h4>
                      <p>
                        📅 {new Date(event.date).toLocaleDateString()} •
                        🕐 {event.time || 'TBD'} •
                        📍 {event.location}, {event.city}
                      </p>
                      <div className="event-meta">
                        <span className="badge badge-secondary">Capacity: {event.capacity}</span>
                        <span className={`badge badge-${event.status === 'published' ? 'success' : 'secondary'}`}>
                          {event.status}
                        </span>
                      </div>
                    </div>
                    <div className="event-item-actions">
                      <Link
                        to={`/analytics/events/${event.id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View Analytics
                      </Link>
                      <button
                        onClick={() => navigate(`/scanner?event=${event.id}`)}
                        className="btn btn-primary btn-sm"
                      >
                        Open Scanner
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-section wide">
            <div className="section-header">
              <h2 className="section-title">Recent Scans</h2>
            </div>
            {recentScans.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-icon">📷</p>
                <p className="empty-state-title">No recent scans</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Ticket</th>
                      <th>Result</th>
                      <th>Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.map((scan, i) => (
                      <tr key={i}>
                        <td>{new Date(scan.scannedAt).toLocaleString()}</td>
                        <td className="ticket-ref">{scan.ticketNumber || 'N/A'}</td>
                        <td>
                          <span className={`badge ${scan.result === 'valid' ? 'badge-success' : scan.result === 'already_used' ? 'badge-warning' : 'badge-danger'}`}>
                            {scan.result}
                          </span>
                        </td>
                        <td>{scan.event?.title || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {performance.length > 0 && (
          <div className="dashboard-section">
            <div className="section-header">
              <h2 className="section-title">My Performance</h2>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coordinator</th>
                    <th>Total Scans</th>
                    <th>Valid</th>
                    <th>Failed</th>
                    <th>Already Used</th>
                    <th>Wrong Event</th>
                    <th>Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((p) => (
                    <tr key={p.coordinator.id}>
                      <td>{p.coordinator.name} ({p.coordinator.role})</td>
                      <td>{p.totalScans}</td>
                      <td>{p.validScans}</td>
                      <td>{p.failedScans}</td>
                      <td>{p.alreadyUsed}</td>
                      <td>{p.wrongEvent}</td>
                      <td>{p.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
