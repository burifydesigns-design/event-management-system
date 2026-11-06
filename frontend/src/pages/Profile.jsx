import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (user) setName(user.name || '')
    setLoading(false)
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateProfile({ name })
      setSuccess('Profile updated successfully!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading text="Loading profile..." />

  return (
    <div className="page page--profile">
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <h1>My profile</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Update your account information.</p>
        </div>
        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, padding: 14, background: 'var(--sf2)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: 'var(--mu)', fontWeight: 600 }}>Email</span>
            <span style={{ color: 'var(--tx)' }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: 'var(--mu)', fontWeight: 600 }}>Role</span>
            <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{user?.role}</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label>Full name</label>
            <input id="name" className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Update profile'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
