import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEvent, updateEvent } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'

export default function EditEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: '', description: '', category: '', date: '', time: '',
    location: '', city: '', capacity: '', price: '', image: '', status: '',
    colorA: '#0b6b4f', colorB: '#f2b01e',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const COLOR_PRESETS = [
    ['#0b6b4f', '#f2b01e'], ['#5b2a86', '#ff9ec7'], ['#0a7e8c', '#b8f2e6'],
    ['#b4440e', '#ffe066'], ['#1f7a4d', '#d9f99d'], ['#1d3557', '#8ecae6'],
  ]

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await getEvent(id)
        if (user.role !== 'admin' && data.organizer?._id !== user._id) {
          navigate('/events')
          return
        }
        setFormData({
          title: data.title || '', description: data.description || '',
          category: data.category || '',
          date: data.date ? data.date.split('T')[0] : '',
          time: data.time || '', location: data.location || '',
          city: data.city || '', capacity: data.capacity || '',
          price: data.price || '', image: data.image || '',
          status: data.status || '',
          colorA: data.colorA || '#0b6b4f', colorB: data.colorB || '#f2b01e',
        })
      } catch {
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
        ...formData, capacity: parseInt(formData.capacity) || 0,
        price: formData.price ? parseFloat(formData.price) : 0,
      }
      await updateEvent(id, eventData)
      setSuccess('Event updated successfully!')
      setTimeout(() => { navigate(`/events/${id}`) }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }) }
  const setColor = (a, b) => { setFormData({ ...formData, colorA: a, colorB: b }) }

  if (loading) return <Loading text="Loading event..." />

  const isAdmin = user?.role === 'admin'

  return (
    <div className="page page--edit-event">
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <h1>Edit event</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Update event details.</p>
        </div>
        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <div className="field">
              <label>Event title</label>
              <input id="title" className="input" type="text" name="title" value={formData.title} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select id="category" className="input" name="category" value={formData.category} onChange={handleChange} required>
                <option value="">Select category</option>
                <option value="Technology">Technology</option>
                <option value="Business">Business</option>
                <option value="Music">Music</option>
                <option value="Food">Food</option>
                <option value="Arts">Arts</option>
                <option value="Sports">Sports</option>
                <option value="Education">Education</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea id="description" className="input" name="description" value={formData.description} onChange={handleChange} rows={5} required />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Date</label>
              <input id="date" className="input" type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Time</label>
              <input id="time" className="input" type="time" name="time" value={formData.time} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Location</label>
              <input id="location" className="input" type="text" name="location" value={formData.location} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>City</label>
              <input id="city" className="input" type="text" name="city" value={formData.city} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Capacity</label>
              <input id="capacity" className="input" type="number" name="capacity" value={formData.capacity} onChange={handleChange} min="1" required />
            </div>
            <div className="field">
              <label>Price (KES)</label>
              <input id="price" className="input" type="number" name="price" value={formData.price} onChange={handleChange} min="0" step="0.01" />
            </div>
          </div>
          <div className="field">
            <label>Image URL (WebP/AVIF recommended)</label>
            <input id="image" className="input" type="url" name="image" value={formData.image} onChange={handleChange} placeholder="https://example.com/image.webp" />
          </div>
          <div className="field">
            <label>Event colors</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {COLOR_PRESETS.map(([a, b]) => (
                <button key={`${a}-${b}`} type="button" onClick={() => setColor(a, b)} style={{ width: 30, height: 30, borderRadius: 6, border: `2px solid ${formData.colorA === a && formData.colorB === b ? 'var(--tx)' : 'var(--ln)'}`, background: `linear-gradient(115deg, ${a} 0%, ${a} 68%)`, cursor: 'pointer' }} aria-label={`Colors ${a} / ${b}`} />
              ))}
            </div>
          </div>
          {isAdmin && (
            <div className="field">
              <label>Status</label>
              <select id="status" className="input" name="status" value={formData.status} onChange={handleChange}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          <div className="form-actions">
            <button type="button" onClick={() => navigate(-1)} className="btn btn--ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn--primary">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
