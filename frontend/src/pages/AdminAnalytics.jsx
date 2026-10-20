import { useState, useEffect } from 'react'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getAnalytics } from '../services/adminService'

const RANGE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

function rangeDates(value) {
  if (value === 'all') return { startDate: '', endDate: '' }
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - Number(value))
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

export default function AdminAnalytics() {
  const [range, setRange] = useState('all')
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { startDate, endDate } = rangeDates(range)
        const data = await getAnalytics({ startDate, endDate })
        setAnalytics(data)
      } catch (err) {
        setError('Unable to load analytics.')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [range])

  if (loading) return <Loading text="Loading analytics..." />
  if (error) return <ErrorMessage message={error} />

  const registrationsOverTime = analytics?.registrationsOverTime || []
  const maxOverTime =
    registrationsOverTime.length > 0
      ? Math.max(...registrationsOverTime.map((item) => item.count))
      : 1

  const registrationsPerEvent = analytics?.registrationsPerEvent || []
  const maxRegistrations =
    registrationsPerEvent.length > 0
      ? Math.max(...registrationsPerEvent.map((item) => item.count))
      : 1

  return (
    <div className="page-admin-analytics">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Platform insights and metrics</p>
        </div>

        <div className="analytics-filters">
          <label className="form-label">Date range</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="form-select"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Registrations Over Time</h3>
            <div className="chart-bars">
              {registrationsOverTime.map((item) => (
                <div key={item._id} className="chart-bar-group">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(item.count / maxOverTime) * 100}%`,
                    }}
                  ></div>
                  <span className="chart-bar-label">{item._id}</span>
                  <span className="chart-bar-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-card">
            <h3>Registrations Per Event</h3>
            <div className="chart-bars chart-bars--horizontal">
              {registrationsPerEvent.map((item) => (
                <div key={item.eventId} className="chart-bar-group">
                  <span className="chart-bar-label">{item.eventName}</span>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar chart-bar--fill"
                      style={{ width: `${(item.count / maxRegistrations) * 100}%` }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-card">
            <h3>Check-in Rate</h3>
            <div className="analytics-metrics">
              <div className="metric">
                <span className="metric-value">
                  {Number(analytics?.checkInRate || 0).toFixed(2)}%
                </span>
                <span className="metric-label">Check-in Rate</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {analytics?.totalCheckedIn || 0}
                </span>
                <span className="metric-label">Checked In</span>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <h3>Capacity Utilization</h3>
            <div className="chart-bars chart-bars--horizontal">
              {(analytics?.capacityUtilization || []).map((item) => (
                <div key={item.eventId} className="chart-bar-group">
                  <span className="chart-bar-label">{item.eventName}</span>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar chart-bar--fill"
                      style={{ width: `${Number(item.utilization || 0)}%` }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">
                    {Number(item.utilization || 0).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
