import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEvent, updateEvent } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import '../styles/forms.css'

export default function EditEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    location: '',
    city: '',
    capacity: '',
    price: '',
    image: '',
    status: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await getEvent(id)
        if (user.role !== 'admin' && data.organizer?._id !== user._id) {
          navigate('/events')
          return
        }
        setFormData({
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          date: data.date ? data.date.split('T')[0] : '',
          time: data.time || '',
          location: data.location || '',
          city: data.city || '',
          capacity: data.capacity || '',
          price: data.price || '',
          image: data.image || '',
          status: data.status || '',
        })
      } catch (err) {
        setError('Unable to load event. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [id, user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const eventData = {
        ...formData,
        capacity: parseInt(formData.capacity),
        price: formData.price ? parseFloat(formData.price) : 0,
      }
      await updateEvent(id, eventData)
      setSuccess('Event updated successfully!')
      setTimeout(() => {
        navigate(`/events/${id}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (loading) return <Loading text="Loading event..." />

  return (
    <div className="page-form">
      <div className="container">
        <div className="form-card">
          <div className="form-header">
            <h1 className="form-title">Edit Event</h1>
            <p className="form-subtitle">Update event details</p>
          </div>

          {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
          {success && <SuccessMessage message={success} />}

          <form onSubmit={handleSubmit} className="form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="title" className="form-label">Event Title *</label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="category" className="form-label">Category *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="">Select category</option>
                  <option value="Technology">Technology</option>
                  <option value="Business">Business</option>
                  <option value="Music">Music</option>
                  <option value="Sports">Sports</option>
                  <option value="Arts">Arts</option>
                  <option value="Education">Education</option>
                  <option value="Health">Health</option>
                  <option value="Food">Food</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-textarea"
                rows={5}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date" className="form-label">Date *</label>
                <input
                  id="date"
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="time" className="form-label">Time</label>
                <input
                  id="time"
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location" className="form-label">Location *</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="city" className="form-label">City *</label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="capacity" className="form-label">Capacity *</label>
                <input
                  id="capacity"
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="form-input"
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="price" className="form-label">Price ($)</label>
                <input
                  id="price"
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="form-input"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="image" className="form-label">Image URL</label>
              <input
                id="image"
                type="url"
                name="image"
                value={formData.image}
                onChange={handleChange}
                className="form-input"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {user?.role === 'admin' && (
              <div className="form-group">
                <label htmlFor="status" className="form-label">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
