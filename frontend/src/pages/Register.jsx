import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validationError, setValidationError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setValidationError(null)
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match.')
      return
    }
    if (formData.password.length < 6) {
      setValidationError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await register(formData.name, formData.email, formData.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--auth">
      <div className="container" style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 34, marginBottom: 6 }}>Create account</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Join and start discovering events</p>
        </div>
        {(error || validationError) && (
          <ErrorMessage message={error || validationError} onClose={() => { setError(null); setValidationError(null) }} />
        )}
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label>Full name</label>
            <input id="name" className="input" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input id="email" className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input id="password" className="input" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required minLength={6} />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input id="confirmPassword" className="input" type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="••••••••" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
          </div>
        </form>
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--mu)', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
