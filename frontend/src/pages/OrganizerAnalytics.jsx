import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getOrganizerAnalytics } from '../services/adminService'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const CHART_COLORS = {
  primary: 'rgba(79, 70, 229, 0.8)',
  primaryLight: 'rgba(79, 70, 229, 0.1)',
  success: 'rgba(16, 185, 129, 0.8)',
  successLight: 'rgba(16, 185, 129, 0.1)',
  warning: 'rgba(245, 158, 11, 0.8)',
  danger: 'rgba(239, 68, 68, 0.8)',
  gray: 'rgba(107, 114, 128, 0.8)',
}

export default function OrganizerAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('30d')

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getOrganizerAnalytics({ range: dateRange })
        setAnalytics(data)
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load analytics.')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [dateRange])

  if (loading) return <Loading text="Loading analytics..." />
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />

  const summary = analytics?.summary || {}
  const registrationsOverTime = analytics?.registrationsOverTime || []
  const registrationsPerEvent = analytics?.registrationsPerEvent || []
  const capacityUtilization = analytics?.capacityUtilization || []
  const topEvents = analytics?.topEvents || []

  const statCards = [
    { label: 'Total Events', value: summary.totalEvents || 0, color: 'primary', icon: '📅' },
    { label: 'Upcoming Events', value: summary.upcomingEvents || 0, color: 'success', icon: '🔜' },
    { label: 'Past Events', value: summary.pastEvents || 0, color: 'secondary', icon: '📜' },
    { label: 'Total Registrations', value: summary.totalRegistrations || 0, color: 'accent', icon: '🎫' },
    { label: 'Active Registrations', value: summary.activeRegistrations || 0, color: 'primary', icon: '✅' },
    { label: 'Checked-in Attendees', value: summary.checkedInAttendees || 0, color: 'success', icon: '✓' },
    { label: 'Check-in Rate', value: `${summary.checkInRate || 0}%`, color: 'warning', icon: '📊' },
  ]

  const registrationTrendData = useMemo(() => ({
    labels: registrationsOverTime.map(item => item._id),
    datasets: [
      {
        label: 'Registrations',
        data: registrationsOverTime.map(item => item.count),
        borderColor: CHART_COLORS.primary,
        backgroundColor: CHART_COLORS.primaryLight,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }), [registrationsOverTime])

  const eventPerformanceData = useMemo(() => ({
    labels: registrationsPerEvent.slice(0, 10).map(item => item.eventName),
    datasets: [
      {
        label: 'Registrations',
        data: registrationsPerEvent.slice(0, 10).map(item => item.count),
        backgroundColor: CHART_COLORS.primary,
        borderRadius: 6,
      },
    ],
  }), [registrationsPerEvent])

  const checkInData = useMemo(() => {
    const checkedIn = summary.checkedInAttendees || 0
    const notCheckedIn = Math.max(0, (summary.activeRegistrations || 0) - checkedIn)
    return {
      labels: ['Checked In', 'Not Checked In'],
      datasets: [
        {
          data: [checkedIn, notCheckedIn],
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.gray],
          borderWidth: 0,
        },
      ],
    }
  }, [summary.checkedInAttendees, summary.activeRegistrations])

  const capacityData = useMemo(() => ({
    labels: capacityUtilization.slice(0, 10).map(item => item.title),
    datasets: [
      {
        label: 'Utilization %',
        data: capacityUtilization.slice(0, 10).map(item => Math.round(item.utilization)),
        backgroundColor: capacityUtilization.slice(0, 10).map(item =>
          item.utilization >= 90 ? CHART_COLORS.danger :
          item.utilization >= 70 ? CHART_COLORS.warning :
          CHART_COLORS.success
        ),
        borderRadius: 6,
      },
    ],
  }), [capacityUtilization])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } },
    },
  }

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: (context) => `Registrations: ${context.parsed.y}`,
        },
      },
    },
  }

  return (
    <div className="page-admin-analytics">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Event Analytics</h1>
            <p className="page-subtitle">Insights for your events</p>
          </div>
          <div className="date-range-selector">
            <label htmlFor="date-range" className="visually-hidden">Time range</label>
            <select
              id="date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="form-select"
            >
              {DATE_RANGES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div className="stats-grid">
          {statCards.map((stat) => (
            <div key={stat.label} className={`stat-card stat-card--${stat.color}`}>
              <span className="stat-icon" aria-hidden="true">{stat.icon}</span>
              <div className="stat-content">
                <p className="stat-value">{stat.value.toLocaleString ? stat.value.toLocaleString() : stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="analytics-grid">
          <div className="analytics-card chart-card">
            <h3 className="chart-title">Registration Trend</h3>
            {registrationsOverTime.length > 0 ? (
              <div className="chart-wrapper">
                <Line data={registrationTrendData} options={lineChartOptions} />
              </div>
            ) : (
              <div className="empty-chart">No registration data for this period</div>
            )}
          </div>

          <div className="analytics-card chart-card">
            <h3 className="chart-title">Check-in Overview</h3>
            {(summary.activeRegistrations || 0) > 0 ? (
              <div className="chart-wrapper chart-wrapper--square">
                <Doughnut data={checkInData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } },
                    tooltip: chartOptions.plugins.tooltip,
                  },
                  cutout: '65%',
                }} />
              </div>
            ) : (
              <div className="empty-chart">No active registrations</div>
            )}
          </div>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card chart-card">
            <h3 className="chart-title">Top Events by Registrations</h3>
            {registrationsPerEvent.length > 0 ? (
              <div className="chart-wrapper">
                <Bar data={eventPerformanceData} options={chartOptions} />
              </div>
            ) : (
              <div className="empty-chart">No event registrations yet</div>
            )}
          </div>

          <div className="analytics-card chart-card">
            <h3 className="chart-title">Capacity Utilization</h3>
            {capacityUtilization.length > 0 ? (
              <div className="chart-wrapper">
                <Bar data={capacityData} options={chartOptions} />
              </div>
            ) : (
              <div className="empty-chart">No capacity data available</div>
            )}
          </div>
        </div>

        <div className="analytics-card table-card">
          <h3 className="chart-title">Event Performance Details</h3>
          {topEvents.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Registrations</th>
                    <th>Capacity</th>
                    <th>Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {topEvents.map((event) => (
                    <tr key={event.eventId}>
                      <td>
                        <Link to={`/events/${event.eventId}`} className="table-link">
                          {event.eventName}
                        </Link>
                      </td>
                      <td>{new Date(event.eventDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge badge-${event.eventStatus}`}>
                          {event.eventStatus}
                        </span>
                      </td>
                      <td>{event.registrations}</td>
                      <td>{event.capacity}</td>
                      <td>
                        <div className="occupancy-bar">
                          <div
                            className="occupancy-fill"
                            style={{
                              width: `${Math.min(event.occupancyRate, 100)}%`,
                              backgroundColor:
                                event.occupancyRate >= 90 ? 'var(--danger)' :
                                event.occupancyRate >= 70 ? 'var(--warning)' :
                                'var(--success)',
                            }}
                          ></div>
                          <span className="occupancy-text">{event.occupancyRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state-icon">📭</p>
              <p className="empty-state-title">No events yet</p>
              <p className="empty-state-text">Create events to see analytics.</p>
              <Link to="/create-event" className="btn btn-primary mt-2">Create Event</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}