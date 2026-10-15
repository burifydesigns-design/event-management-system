import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import { getAllEvents } from '../services/adminService'
import { scanQR } from '../services/adminService'

export default function AdminCheckIn() {
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getAllEvents()
        setEvents(data.data || data || [])
      } catch (err) {
        setError('Unable to load events.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  const handleScan = async (e) => {
    e.preventDefault()
    if (!qrInput.trim() || !selectedEventId) {
      setError('Please enter a QR token and select an event.')
      return
    }

    setScanning(true)
    setError(null)
    setScanResult(null)

    try {
      const result = await scanQR(qrInput.trim(), selectedEventId)
      setScanResult(result)
      setSuccess(`Successfully checked in: ${result.attendeeName || 'Attendee'}`)
      setQrInput('')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid QR code or check-in failed.')
    } finally {
      setScanning(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      // In a real app, you would use a QR code scanning library
      // For demo purposes, we'll just show the file content
      setQrInput(event.target.result.substring(0, 100))
      setSuccess('QR code image loaded. Enter the full QR token below.')
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <Loading text="Loading check-in page..." />

  return (
    <div className="page-admin-checkin">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">QR Check-in</h1>
          <p className="page-subtitle">Scan or enter QR codes to check in attendees</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

        <div className="checkin-card">
          <div className="form-group">
            <label className="form-label">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="form-select"
            >
              <option value="">Choose an event...</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.title} - {new Date(event.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleScan} className="checkin-form">
            <div className="form-group">
              <label className="form-label">QR Token / Ticket Number</label>
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="form-input"
                placeholder="Enter QR token or scan..."
                required
              />
            </div>

            <button type="submit" disabled={scanning} className="btn btn-primary btn-lg">
              {scanning ? 'Checking in...' : 'Check In'}
            </button>
          </form>

          <div className="checkin-upload">
            <p className="checkin-upload-text">Or upload a QR code image:</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="file-input"
            />
          </div>
        </div>

        {scanResult && (
          <div className="checkin-result">
            <h3>Check-in Result</h3>
            <div className="checkin-result-card">
              <p><strong>Attendee:</strong> {scanResult.attendeeName || 'N/A'}</p>
              <p><strong>Email:</strong> {scanResult.attendeeEmail || 'N/A'}</p>
              <p><strong>Ticket:</strong> {scanResult.ticketNumber || 'N/A'}</p>
              <p><strong>Status:</strong> {scanResult.status || 'Confirmed'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
