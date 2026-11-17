import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const recoveryError = params.get('error_description')
    if (recoveryError || !accessToken || !refreshToken || params.get('type') !== 'recovery') {
      setError(recoveryError || 'This reset link is invalid or has expired. Request a new one.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/auth/reset-password', {
        accessToken,
        refreshToken,
        password,
      })
      window.history.replaceState({}, document.title, window.location.pathname)
      setMessage(data.message || 'Your password has been updated. You can now sign in.')
      setPassword('')
      setConfirmPassword('')
      window.setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err) {
      setError(err.response?.data?.message || 'The reset link may have expired. Request a new one and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--auth">
      <div className="container" style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>Choose a new password</h1>
          <p style={{ color: 'var(--mu)', fontSize: 14 }}>Use at least 8 characters. You’ll be able to sign in with it once saved.</p>
        </div>
        {message && <div role="status" className="success-message" style={{ marginBottom: 16 }}>{message}</div>}
        {error && <div role="alert" className="error-message" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" className="input" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Updating…' : 'Save new password'}</button>
          </div>
        </form>
        <p style={{ marginTop: 18, textAlign: 'center', fontSize: 14 }}><Link to="/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Back to sign in</Link></p>
      </div>
    </div>
  )
}
