import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import { getAllEvents } from '../services/adminService'
import { deleteEvent, publishEvent } from '../services/eventService'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const data = await getAllEvents()
      setEvents(data.data || data || [])
    } catch (err) {
      setError('Unable to load events.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setActionLoading(true)
      await deleteEvent(deleteId)
      setEvents((prev) => prev.filter((e) => e._id !== deleteId))
      setSuccess('Event deleted successfully.')
      setDeleteId(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event.')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePublish = async (id) => {
    try {
      setActionLoading(true)
      await publishEvent(id)
      setEvents((prev) =>
        prev.map((e) => (e._id === id ? { ...e, status: 'published' } : e))
      )
      setSuccess('Event published successfully.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish event.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page-admin-events">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Event Management</h1>
            <p className="page-subtitle">Manage all events on the platform</p>
          </div>
          <Link to="/create-event" className="btn btn-primary">
            Create Event
          </Link>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        {loading ? (
          <Loading text="Loading events..." />
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📭</p>
            <p className="empty-state-title">No events found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th>Registrations</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event._id}>
                    <td>
                      <Link to={`/events/${event._id}`} className="table-link">
                        {event.title}
                      </Link>
                    </td>
                    <td>{event.category}</td>
                    <td>{new Date(event.date).toLocaleDateString()}</td>
                    <td>{event.city}</td>
                    <td>
                      <span className={`badge badge-${event.status}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>{event.capacity}</td>
                    <td>{event.registeredCount || 0}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/edit-event/${event._id}`} className="btn btn-sm btn-outline">
                          Edit
                        </Link>
                        {event.status === 'draft' && (
                          <button
                            onClick={() => handlePublish(event._id)}
                            disabled={actionLoading}
                            className="btn btn-sm btn-primary"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(event._id)}
                          className="btn btn-sm btn-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        visible={!!deleteId}
        message="Are you sure you want to delete this event? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
