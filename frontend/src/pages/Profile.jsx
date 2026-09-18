import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await updateProfile()
        setFormData({ name: data.name || '', email: data.email || '' })
      } catch (err) {
        setError('Unable to load profile. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await updateProfile(formData)
      setSuccess('Profile updated successfully!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (loading) return <Loading text="Loading profile..." />

  return (
    <div className="page-profile">
      <div className="container">
        <div className="profile-card">
          <div className="profile-header">
            <h1 className="profile-title">My Profile</h1>
            <p className="profile-subtitle">Update your account information</p>
          </div>

          {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
          {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

          <div className="profile-info">
            <div className="profile-field">
              <span className="profile-label">Role</span>
              <span className="profile-value profile-role">{user?.role}</span>
            </div>
            <div className="profile-field">
              <span className="profile-label">Member Since</span>
              <span className="profile-value">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Full Name</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
