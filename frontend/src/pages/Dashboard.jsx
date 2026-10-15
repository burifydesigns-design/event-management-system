import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getDashboard } from '../services/adminService'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await getDashboard()
        setStats(data)
      } catch (err) {
        setError('Unable to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) return <Loading text="Loading dashboard..." />
  if (error) return <ErrorMessage message={error} />

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: '👥', color: 'primary' },
    { label: 'Total Events', value: stats?.totalEvents || 0, icon: '📅', color: 'secondary' },
    { label: 'Total Registrations', value: stats?.totalRegistrations || 0, icon: '🎫', color: 'accent' },
    { label: 'Upcoming Events', value: stats?.upcomingEvents || 0, icon: '📆', color: 'success' },
    { label: 'Available Seats', value: stats?.availableSeats || 0, icon: '💺', color: 'warning' },
    { label: 'Checked-in Attendees', value: stats?.checkedInAttendees || 0, icon: '✅', color: 'primary' },
  ]

  return (
    <div className="page-dashboard">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Overview of your platform</p>
        </div>

        <div className="stats-grid">
          {statCards.map((stat) => (
            <div key={stat.label} className={`stat-card stat-card--${stat.color}`}>
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-content">
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <h2 className="dashboard-section-title">Quick Actions</h2>
            <div className="dashboard-actions">
              <Link to="/admin/events" className="dashboard-action-card">
                <span className="dashboard-action-icon">📅</span>
                <span>Manage Events</span>
              </Link>
              <Link to="/admin/users" className="dashboard-action-card">
                <span className="dashboard-action-icon">👥</span>
                <span>Manage Users</span>
              </Link>
              <Link to="/admin/attendees" className="dashboard-action-card">
                <span className="dashboard-action-icon">🎫</span>
                <span>View Attendees</span>
              </Link>
              <Link to="/admin/check-in" className="dashboard-action-card">
                <span className="dashboard-action-icon">📷</span>
                <span>QR Check-in</span>
              </Link>
              <Link to="/admin/analytics" className="dashboard-action-card">
                <span className="dashboard-action-icon">📊</span>
                <span>Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
