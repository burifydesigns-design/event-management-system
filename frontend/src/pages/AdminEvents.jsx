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
      setSuccess('Event deleted.')
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
      setSuccess('Event published.')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish event.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page page--admin">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div>
            <h1>Events</h1>
            <p style={{ color: 'var(--mu)', fontSize: 14 }}>Manage all events on the platform.</p>
          </div>
          <Link to="/create-event" className="btn btn--primary">New event</Link>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        {loading ? (
          <Loading text="Loading events..." />
        ) : events.length === 0 ? (
          <p style={{ color: 'var(--mu)', textAlign: 'center', padding: 24 }}>No events found.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Event</th>
                  <th style={{ width: '16%' }}>Category</th>
                  <th style={{ width: '16%' }}>Date</th>
                  <th style={{ width: '14%' }}>City</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '12%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{event.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--mu)' }}>{new Date(event.date).toLocaleDateString()}</div>
                    </td>
                    <td>{event.category}</td>
                    <td>{event.city}</td>
                    <td>
                      <span className={`pill ${event.status === 'published' ? 'pill--ok' : 'pill--bad'}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Link to={`/edit-event/${event._id}`} className="btn btn--ghost" style={{ height: 36, padding: '0 10px', fontSize: 13 }}>Edit</Link>
                        {event.status === 'draft' && (
                          <button onClick={() => handlePublish(event._id)} disabled={actionLoading} className="btn btn--ghost" style={{ height: 36, padding: '0 10px', fontSize: 13 }}>Publish</button>
                        )}
                        <button onClick={() => setDeleteId(event._id)} className="btn btn--icon" aria-label={`Delete ${event.title}`} title="Delete">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          visible={!!deleteId}
          message="Are you sure you want to delete this event?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      </div>
    </div>
  )
}
