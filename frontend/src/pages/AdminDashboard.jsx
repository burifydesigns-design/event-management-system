import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getOverviewAnalytics,
  getPlatformAnalytics,
  exportRegistrationsCSV,
} from '../services/ticketService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import {
  Bar,
  Line,
  Doughnut,
} from 'react-chartjs-2'

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [platform, setPlatform] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchData()
  }, [dateRange.start, dateRange.end])

  async function fetchData() {
    try {
      setLoading(true)
      const [overviewRes, platformRes] = await Promise.all([
        getOverviewAnalytics(),
        getPlatformAnalytics({ start: dateRange.start, end: dateRange.end }),
      ])
      setOverview(overviewRes)
      setPlatform(platformRes)
    } catch (err) {
      setError('Unable to load admin dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading text="Loading admin dashboard..." />
  if (error) return <ErrorMessage message={error} />

  const totalUsers = overview?.totalUsers || 0
  const totalEvents = overview?.totalEvents || 0
  const totalRegistrations = overview?.totalRegistrations || 0
  const attendanceRate = overview?.attendanceRate || 0
  const grossRevenue = overview?.grossRevenue || 0

  const regTrends = overview?.registrationTrends || []
  const checkInTrends = overview?.checkInTrends || []
  const revTrends = platform?.revenueOverTime || []
  const eventsByCategory = platform?.eventsByCategory || []
  const topEvents = platform?.topEvents || []

  return (
    <div className="page-dashboard page-dashboard--admin">
      <div className="container">
        <div className="page-header">
          <div className="header-content">
            <h1 className="page-title">Platform Admin Center</h1>
            <p className="page-subtitle">Platform-wide oversight and analytics</p>
          </div>
          <div className="header-actions">
            <Link to="/admin/events" className="btn btn-outline">
              Manage Events
            </Link>
            <Link to="/admin/users" className="btn btn-outline">
              Manage Users
            </Link>
          </div>
        </div>

        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="date-filter">
          <label>Date Range</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
          <button onClick={fetchData} className="btn btn-outline btn-sm">Apply</button>
          <button
            onClick={async () => {
              try {
                const blob = await exportRegistrationsCSV({ start: dateRange.start, end: dateRange.end })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `platform-registrations-${new Date().toISOString().slice(0,10)}.csv`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)
                setSuccess('CSV exported successfully.')
              } catch (err) {
                setError('Failed to export CSV.')
              }
            }}
            className="btn btn-outline"
          >
            Export CSV
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-card--primary">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <p className="stat-value">{totalUsers}</p>
              <p className="stat-label">Total Users</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-value">{totalEvents}</p>
              <p className="stat-label">Total Events</p>
            </div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-value">{totalRegistrations}</p>
              <p className="stat-label">Total Registrations</p>
            </div>
          </div>
          <div className="stat-card stat-card--info">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <p className="stat-value">${grossRevenue.toLocaleString()}</p>
              <p className="stat-label">Gross Revenue</p>
            </div>
          </div>
          <div className="stat-card stat-card--warning">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <p className="stat-value">{attendanceRate}%</p>
              <p className="stat-label">Check-in Rate</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Platform Registration Trends</h2>
            </div>
            <div className="chart-wrapper">
              {regTrends.length > 0 ? (
                <Line
                  data={{
                    labels: regTrends.map((d) => d._id),
                    datasets: [{
                      label: 'Registrations',
                      data: regTrends.map((d) => d.count),
                      borderColor: '#4f46e5',
                      backgroundColor: 'rgba(79, 70, 229, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Platform Check-ins</h2>
            </div>
            <div className="chart-wrapper">
              {checkInTrends.length > 0 ? (
                <Line
                  data={{
                    labels: checkInTrends.map((d) => d._id),
                    datasets: [{
                      label: 'Check-ins',
                      data: checkInTrends.map((d) => d.count),
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Events by Category</h2>
            </div>
            <div className="chart-wrapper">
              {eventsByCategory.length > 0 ? (
                <Doughnut
                  data={{
                    labels: eventsByCategory.map((e) => e._id),
                    datasets: [{
                      data: eventsByCategory.map((e) => e.count),
                      backgroundColor: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                />
              ) : (
                <div className="empty-state"><p>No data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Revenue Over Time</h2>
            </div>
            <div className="chart-wrapper">
              {revTrends.length > 0 ? (
                <Bar
                  data={{
                    labels: revTrends.map((d) => d._id),
                    datasets: [{
                      label: 'Revenue ($)',
                      data: revTrends.map((d) => d.gross),
                      backgroundColor: '#4f46e5',
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No data.</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Top Events by Registrations</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Registrations</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((e, i) => (
                  <tr key={i}>
                    <td>{e.title}</td>
                    <td>{e.registrations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
