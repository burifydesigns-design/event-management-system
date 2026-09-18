import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createEvent } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import '../styles/forms.css'

export default function CreateEvent() {
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
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const validateForm = () => {
    const errors = {}
    const trimmed = {}

    const textFields = ['title', 'description', 'location', 'city']
    for (const field of textFields) {
      trimmed[field] = formData[field].trim()
      if (!trimmed[field]) {
        errors[field] = 'This field is required'
      }
    }

    if (!formData.category) {
      errors.category = 'Please select a category'
    }

    if (!formData.date) {
      errors.date = 'Date is required'
    }

    if (!formData.time) {
      errors.time = 'Time is required'
    }

    if (!formData.capacity && formData.capacity !== 0) {
      errors.capacity = 'Capacity is required'
    } else if (parseInt(formData.capacity, 10) < 1) {
      errors.capacity = 'Capacity must be at least 1'
    }

    if (formData.price !== '' && (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0)) {
      errors.price = 'Price cannot be negative'
    }

    if (formData.image && formData.image.trim()) {
      try {
        new URL(formData.image.trim())
      } catch {
        errors.image = 'Please enter a valid image URL'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    setFieldErrors({})

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      const eventData = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        location: formData.location.trim(),
        city: formData.city.trim(),
        capacity: parseInt(formData.capacity, 10),
        price: formData.price ? parseFloat(formData.price) : 0,
        image: formData.image.trim(),
      }
      const data = await createEvent(eventData)
      setSuccess('Event created successfully!')
      setTimeout(() => {
        navigate(`/events/${data._id || data.id}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFieldErrors({ ...fieldErrors, [e.target.name]: '' })
  }

  return (
    <div className="page-form">
      <div className="container">
        <div className="form-card">
          <div className="form-header">
            <h1 className="form-title">Create Event</h1>
            <p className="form-subtitle">Fill in the details to create a new event</p>
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
                {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
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
                  <option value="Education">Education</option>
                  <option value="Sports">Sports</option>
                  <option value="Arts">Arts</option>
                  <option value="Other">Other</option>
                </select>
                {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
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
              {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
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
                {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="time" className="form-label">Time *</label>
                <input
                  id="time"
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
                {fieldErrors.time && <span className="field-error">{fieldErrors.time}</span>}
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
                {fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}
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
                {fieldErrors.city && <span className="field-error">{fieldErrors.city}</span>}
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
                {fieldErrors.capacity && <span className="field-error">{fieldErrors.capacity}</span>}
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
                {fieldErrors.price && <span className="field-error">{fieldErrors.price}</span>}
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
              {fieldErrors.image && <span className="field-error">{fieldErrors.image}</span>}
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate('/events')} className="btn btn-outline">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
