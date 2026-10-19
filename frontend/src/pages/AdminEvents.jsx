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
  const [deleteEventRecord, setDeleteEventRecord] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [filters, setFilters] = useState({ search: '', category: '', city: '', status: 'all', date: 'all' })
  const [appliedFilters, setAppliedFilters] = useState({})

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getAllEvents(appliedFilters)
        setEvents(data.data || data || [])
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load events.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [appliedFilters])

  const handleDelete = async () => {
    if (actionLoading || !deleteEventRecord) return
    try {
      setActionLoading(true)
      setError(null)
      const result = await deleteEvent(deleteEventRecord._id)
      if (result.cancelled) {
        setEvents((prev) => prev.map((event) => (
          event._id === deleteEventRecord._id ? { ...event, status: 'cancelled' } : event
        )))
      } else {
        setEvents((prev) => prev.filter((event) => event._id !== deleteEventRecord._id))
      }
      setSuccess(result.message || (result.cancelled ? 'Event cancelled.' : 'Event deleted.'))
      setDeleteEventRecord(null)
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

        <form
          className="admin-event-filters"
          onSubmit={(event) => {
            event.preventDefault()
            setAppliedFilters({ ...filters })
          }}
        >
          <label>
            Search title
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              maxLength={100}
            />
          </label>
          <label>
            Category
            <input
              type="search"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              maxLength={100}
            />
          </label>
          <label>
            City
            <input
              type="search"
              value={filters.city}
              onChange={(event) => setFilters({ ...filters, city: event.target.value })}
              maxLength={100}
            />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Date
            <select value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })}>
              <option value="all">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </label>
          <div className="admin-event-filter-actions">
            <button type="submit" className="btn btn-primary">Apply filters</button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                const reset = { search: '', category: '', city: '', status: 'all', date: 'all' }
                setFilters(reset)
                setAppliedFilters({})
              }}
            >
              Reset
            </button>
          </div>
        </form>

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
                  <th>Seats left</th>
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
                      {event.status === 'published' && new Date(event.date) >= new Date(new Date().setHours(0, 0, 0, 0))
                        ? Math.max(0, event.capacity - (event.registeredCount || 0))
                        : '—'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/edit-event/${event._id}`} className="btn btn-sm btn-outline">
                          Edit
                        </Link>
                        <Link to={`/admin/attendees?eventId=${event._id}`} className="btn btn-sm btn-outline">
                          Attendees
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
                        {event.status !== 'cancelled' && (
                          <button
                            onClick={() => setDeleteEventRecord(event)}
                            className="btn btn-sm btn-danger"
                          >
                            {event.hasRegistrations ? 'Cancel' : 'Delete'}
                          </button>
                        )}
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
        visible={!!deleteEventRecord}
        message={deleteEventRecord?.hasRegistrations
          ? 'This event has registration records. It will be cancelled so issued tickets and attendee history are preserved.'
          : 'Are you sure you want to permanently delete this event?'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteEventRecord(null)}
        confirmLabel={deleteEventRecord?.hasRegistrations ? 'Cancel event' : 'Delete event'}
        confirmDisabled={actionLoading}
      />
    </div>
  )
}
