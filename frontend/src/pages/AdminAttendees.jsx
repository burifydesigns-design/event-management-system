import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import { getAllEvents } from '../services/adminService'
import { getEventAttendees, exportAttendeesCSV } from '../services/adminService'

export default function AdminAttendees() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [attendees, setAttendees] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(searchParams.get('eventId') || '')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getAllEvents()
        setEvents(data.data || data || [])
      } catch (err) {
        setError('Unable to load events.')
      }
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      const fetchAttendees = async () => {
        try {
          setLoading(true)
          const data = await getEventAttendees(selectedEventId)
          setAttendees(data.data || data || [])
        } catch (err) {
          setError('Unable to load attendees.')
        } finally {
          setLoading(false)
        }
      }
      fetchAttendees()
    }
  }, [selectedEventId])

  const handleEventChange = (e) => {
    const eventId = e.target.value
    setSelectedEventId(eventId)
    if (eventId) {
      setSearchParams({ eventId })
    }
  }

  const handleExport = async () => {
    if (!selectedEventId) return
    try {
      setExporting(true)
      const blob = await exportAttendeesCSV(selectedEventId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `attendees-${selectedEventId}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setSuccess('CSV exported successfully.')
    } catch (err) {
      setError('Failed to export CSV.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-admin-attendees">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Attendee Management</h1>
          <p className="page-subtitle">View and export event attendees</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="form-group">
          <label className="form-label">Select Event</label>
          <select
            value={selectedEventId}
            onChange={handleEventChange}
            className="form-select"
          >
            <option value="">Choose an event...</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.title} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <div className="attendees-header">
            <h3>Attendees</h3>
            <button
              onClick={handleExport}
              disabled={exporting || attendees.length === 0}
              className="btn btn-outline"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        )}

        {loading ? (
          <Loading text="Loading attendees..." />
        ) : !selectedEventId ? (
          <div className="empty-state">
            <p className="empty-state-icon">📋</p>
            <p className="empty-state-title">Select an event</p>
            <p className="empty-state-text">Choose an event from the dropdown to view its attendees.</p>
          </div>
        ) : attendees.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">👥</p>
            <p className="empty-state-title">No attendees found</p>
            <p className="empty-state-text">This event has no registered attendees yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Ticket #</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Check-in</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee._id}>
                    <td>{attendee.attendeeName || attendee.user?.name}</td>
                    <td>{attendee.attendeeEmail || attendee.user?.email}</td>
                    <td>{attendee.ticketNumber}</td>
                    <td>{new Date(attendee.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge badge-${attendee.status}`}>
                        {attendee.status}
                      </span>
                    </td>
                    <td>
                      {attendee.checkedIn ? (
                        <span className="badge badge-success">Checked In</span>
                      ) : (
                        <span className="badge badge-secondary">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
