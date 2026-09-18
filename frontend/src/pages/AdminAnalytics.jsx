import { useState, useEffect } from 'react'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getAnalytics } from '../services/adminService'

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await getAnalytics()
        setAnalytics(data)
      } catch (err) {
        setError('Unable to load analytics.')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) return <Loading text="Loading analytics..." />
  if (error) return <ErrorMessage message={error} />

  const maxRegistrations = Math.max(
    ...(analytics?.registrationsPerEvent?.map((e) => e.count) || [1])
  )

  return (
    <div className="page-admin-analytics">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Platform insights and metrics</p>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Registrations Over Time</h3>
            <div className="chart-bars">
              {(analytics?.registrationsOverTime || []).map((item, i) => (
                <div key={i} className="chart-bar-group">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(item.count / Math.max(...(analytics?.registrationsOverTime?.map((x) => x.count) || [1]))) * 100}%`,
                    }}
                  ></div>
                  <span className="chart-bar-label">{item.date}</span>
                  <span className="chart-bar-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-card">
            <h3>Registrations Per Event</h3>
            <div className="chart-bars chart-bars--horizontal">
              {(analytics?.registrationsPerEvent || []).map((item, i) => (
                <div key={i} className="chart-bar-group">
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
                  {analytics?.checkInRate || 0}%
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
              {(analytics?.capacityUtilization || []).map((item, i) => (
                <div key={i} className="chart-bar-group">
                  <span className="chart-bar-label">{item.eventName}</span>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar chart-bar--fill"
                      style={{ width: `${item.utilization}%` }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">{item.utilization}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
