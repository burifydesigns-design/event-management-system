import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getOrganizerAnalytics } from '../services/ticketService'
import {
  listCoordinatorAssignments as listAssignments,
  createCoordinatorAssignment,
  deleteCoordinatorAssignment,
  listCoordinators,
} from '../services/ticketService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  Bar,
  Line,
  Doughnut,
} from 'react-chartjs-2'

export default function OrganizerDashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [coordinators, setCoordinators] = useState([])
  const [assignments, setAssignments] = useState([])
  const [newAssignment, setNewAssignment] = useState({ coordinatorId: '', eventId: '' })
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [dateRange.start, dateRange.end])

  async function fetchData() {
    try {
      setLoading(true)
      const [analyticsRes, eventsRes, coordinatorsRes, assignmentsRes] = await Promise.all([
        getOrganizerAnalytics({ start: dateRange.start, end: dateRange.end }),
        fetch('/api/events', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.json()),
        listCoordinators(),
        listAssignments(),
      ])
      setAnalytics(analyticsRes)
      setEvents(eventsRes.data || eventsRes.events || [])
      setCoordinators(coordinatorsRes.data || [])
      setAssignments(assignmentsRes.data || [])
    } catch (err) {
      setError('Unable to load organizer dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading text="Loading organizer dashboard..." />
  if (error) return <ErrorMessage message={error} />

  const totalConfirmed = analytics?.totalConfirmed || 0
  const totalCheckedIn = analytics?.totalCheckedIn || 0
  const checkInRate = analytics?.checkInRate || 0
  const grossRevenue = analytics?.grossRevenue || 0

  const registrationsOverTime = analytics?.registrationsOverTime || []
  const checkInsOverTime = analytics?.checkInsOverTime || []
  const revenueOverTime = analytics?.revenueOverTime || []
  const capacityUtilization = analytics?.capacityUtilization || []

  return (
    <div className="page-dashboard page-dashboard--organizer">
      <div className="container">
        <div className="page-header">
          <div className="header-content">
            <h1 className="page-title">Organizer Control Center</h1>
            <p className="page-subtitle">Manage your events, tickets, and staff</p>
          </div>
          <div className="header-actions">
            <Link to="/create-event" className="btn btn-primary">
              + Create Event
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
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-card--primary">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-value">{events.length}</p>
              <p className="stat-label">My Events</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-value">{totalConfirmed}</p>
              <p className="stat-label">Tickets Sold</p>
            </div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <p className="stat-value">{totalCheckedIn}</p>
              <p className="stat-label">Checked In</p>
            </div>
          </div>
          <div className="stat-card stat-card--warning">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <p className="stat-value">${grossRevenue.toLocaleString()}</p>
              <p className="stat-label">Gross Revenue</p>
            </div>
          </div>
          <div className="stat-card stat-card--info">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-value">{checkInRate}%</p>
              <p className="stat-label">Check-in Rate</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Registration Trends</h2>
            </div>
            <div className="chart-wrapper">
              {registrationsOverTime.length > 0 ? (
                <Line
                  data={{
                    labels: registrationsOverTime.map((d) => d._id),
                    datasets: [{
                      label: 'Registrations',
                      data: registrationsOverTime.map((d) => d.count),
                      borderColor: '#4f46e5',
                      backgroundColor: 'rgba(79, 70, 229, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No registration data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Check-ins Over Time</h2>
            </div>
            <div className="chart-wrapper">
              {checkInsOverTime.length > 0 ? (
                <Line
                  data={{
                    labels: checkInsOverTime.map((d) => d._id),
                    datasets: [{
                      label: 'Check-ins',
                      data: checkInsOverTime.map((d) => d.count),
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No check-in data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Capacity Utilization</h2>
            </div>
            <div className="chart-wrapper">
              {capacityUtilization.length > 0 ? (
                <Doughnut
                  data={{
                    labels: capacityUtilization.map((e) => e.title),
                    datasets: [{
                      data: capacityUtilization.map((e) => e.utilization),
                      backgroundColor: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'],
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                />
              ) : (
                <div className="empty-state"><p>No events with capacity data.</p></div>
              )}
            </div>
          </div>

          <div className="dashboard-section chart-section">
            <div className="section-header">
              <h2 className="section-title">Revenue Over Time</h2>
            </div>
            <div className="chart-wrapper">
              {revenueOverTime.length > 0 ? (
                <Bar
                  data={{
                    labels: revenueOverTime.map((d) => d._id),
                    datasets: [{
                      label: 'Revenue ($)',
                      data: revenueOverTime.map((d) => d.gross),
                      backgroundColor: '#4f46e5',
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } } }}
                />
              ) : (
                <div className="empty-state"><p>No revenue data.</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Event Performance</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Capacity</th>
                  <th>Registered</th>
                  <th>Checked In</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.events || []).map((event) => (
                  <tr key={event.id}>
                    <td>{event.title}</td>
                    <td>{new Date(event.date).toLocaleDateString()}</td>
                    <td>{event.capacity}</td>
                    <td>{event.registered || 0}</td>
                    <td>{event.checkedIn || 0}</td>
                    <td>{event.utilization ? event.utilization.toFixed(1) + '%' : '0%'}</td>
                    <td><span className={`badge badge-${event.status}`}>{event.status}</span></td>
                    <td>
                      <Link to={`/analytics/events/${event.id}`} className="btn btn-outline btn-sm">Analytics</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title">Coordinator Assignments</h2>
            <button onClick={() => setShowAssignModal(true)} className="btn btn-primary btn-sm">Assign Coordinator</button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coordinator</th>
                  <th>Event</th>
                  <th>Assigned At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.coordinator.name} ({a.coordinator.email})</td>
                    <td>{a.event.title}</td>
                    <td>{new Date(a.assignedAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => setDeleteId(a.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAssignModal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Assign Coordinator to Event</h3>
              </div>
              <div className="modal-body">
                <div className="form">
                  <div className="form-group">
                    <label className="form-label">Coordinator</label>
                    <select
                      value={newAssignment.coordinatorId}
                      onChange={(e) => setNewAssignment({ ...newAssignment, coordinatorId: e.target.value })}
                      className="form-input"
                    >
                      <option value="">Select coordinator</option>
                      {coordinators.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Event</label>
                    <select
                      value={newAssignment.eventId}
                      onChange={(e) => setNewAssignment({ ...newAssignment, eventId: e.target.value })}
                      className="form-input"
                    >
                      <option value="">Select event</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowAssignModal(false)} className="btn btn-outline">Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      await createCoordinatorAssignment(newAssignment)
                      setSuccess('Coordinator assigned successfully.')
                      setShowAssignModal(false)
                      setNewAssignment({ coordinatorId: '', eventId: '' })
                      fetchData()
                    } catch (err) {
                      setError(err.response?.data?.message || 'Failed to assign coordinator.')
                    }
                  }}
                  className="btn btn-primary"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          visible={!!deleteId}
          message="Remove this coordinator assignment?"
          onConfirm={async () => {
            try {
              await deleteCoordinatorAssignment(deleteId)
              setSuccess('Assignment removed.')
              setDeleteId(null)
              fetchData()
            } catch (err) {
              setError(err.response?.data?.message || 'Failed to remove assignment.')
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      </div>
    </div>
  )
}
