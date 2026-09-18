import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register } from '../services/authService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import '../styles/auth.css'

export default function Register() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
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
      const data = await register(formData.name, formData.email, formData.password)
      setUser(data.user)
      navigate('/events')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-auth">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Join EventEase and start discovering events</p>
          </div>

          {(error || validationError) && (
            <ErrorMessage message={error || validationError} onClose={() => { setError(null); setValidationError(null) }} />
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Full Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login" className="link-primary">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
