import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(formData.email, formData.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--auth">
      <div className="container" style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 34, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Sign in to your account</p>
        </div>
        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label>Email</label>
            <input id="email" className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input id="password" className="input" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--mu)', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--ac)', fontWeight: 600 }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
