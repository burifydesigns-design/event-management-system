import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setMessage(data.message || 'If an account matches that email, a reset link will be sent.')
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to request a reset link right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--auth">
      <div className="container" style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>Reset your password</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Enter the email address associated with your account. If it exists, we’ll send a secure reset link.</p>
        </div>
        {message && <div role="status" className="success-message" style={{ marginBottom: 16 }}>{message}</div>}
        {error && <div role="alert" className="error-message" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="reset-email">Email address</label>
            <input id="reset-email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
          </div>
        </form>
        <p style={{ marginTop: 18, textAlign: 'center', fontSize: 14 }}><Link to="/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Back to sign in</Link></p>
      </div>
    </div>
  )
}
