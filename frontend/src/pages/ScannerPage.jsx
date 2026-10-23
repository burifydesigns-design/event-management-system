import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkInTicket, validateTicket, getScannerEvents } from '../services/ticketService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'

export default function ScannerPage() {
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [manualInput, setManualInput] = useState('')
  const [resultMessage, setResultMessage] = useState(null)
  const [resultType, setResultType] = useState(null)
  const [scanHistory, setScanHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const data = await getScannerEvents()
      setEvents(data.data || [])
      if (data.data && data.data.length > 0 && !selectedEventId) {
        setSelectedEventId(data.data[0].id)
      }
    } catch (err) {
      setCameraError('Unable to load assignable events.')
    } finally {
      setLoading(false)
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.')
      return
    }
    try {
      setCameraError(null)
      const constraints = { video: { facingMode: 'environment' } }
      if (selectedCameraId) {
        constraints.video = { deviceId: { exact: selectedCameraId } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
      startScanningLoop()
    } catch (err) {
      let msg = 'Failed to access camera.'
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission was denied. Please allow camera access to scan tickets.'
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is already in use by another application.'
      }
      setCameraError(msg)
      setCameraActive(false)
    }
  }

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setScanning(false)
  }

  async function listCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((d) => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
    } catch (err) {
      // Camera enumeration not supported; continue with default.
    }
  }

  useEffect(() => {
    if (cameraActive) {
      listCameras()
    }
  }, [cameraActive])

  function startScanningLoop() {
    setScanning(true)
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(imageData)
          if (barcodes && barcodes.length > 0) {
            handleScannedValue(barcodes[0].rawValue)
          }
        }
      } catch (err) {
        // Ignore per-frame errors; continue scanning.
      }
    }, 1000)
  }

  async function handleScannedValue(rawValue) {
    if (!selectedEventId) {
      setResultMessage('Please select an event before scanning.')
      setResultType('error')
      setScanResult({ valid: false, message: 'No event selected' })
      return
    }
    stopCamera()
    try {
      const result = await checkInTicket(rawValue, selectedEventId)
      setScanResult(result)
      if (result.valid) {
        setResultMessage('Check-in successful — attendee admitted.')
        setResultType('success')
        setResultDetail(result)
      } else {
        setResultMessage(result.message || 'Check-in failed.')
        setResultType('error')
        setResultDetail(result)
      }
      addToHistory(result, rawValue)
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed.'
      setResultMessage(msg)
      setResultType('error')
      setScanResult({ valid: false, message: msg })
    } finally {
      setTimeout(() => {
        startCamera()
      }, 2500)
    }
  }

  function addToHistory(result, qrToken) {
    const entry = {
      qrToken,
      eventId: selectedEventId,
      result: result.result || 'error',
      message: result.message || '',
      scannedAt: new Date(),
    }
    setScanHistory((prev) => [entry, ...prev].slice(0, 50))
  }

  async function handleManualScan(e) {
    e.preventDefault()
    if (!manualInput.trim() || !selectedEventId) {
      setResultMessage('Please enter a ticket reference and select an event.')
      setResultType('error')
      return
    }
    setScanning(true)
    try {
      const result = await checkInTicket(manualInput.trim(), selectedEventId)
      setScanResult(result)
      if (result.valid) {
        setResultMessage('Check-in successful — attendee admitted.')
        setResultType('success')
      } else {
        setResultMessage(result.message || 'Check-in failed.')
        setResultType('error')
      }
      setManualInput('')
      addToHistory(result, manualInput.trim())
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed.'
      setResultMessage(msg)
      setResultType('error')
      setScanResult({ valid: false, message: msg })
    } finally {
      setScanning(false)
    }
  }

  async function precheckTicket() {
    if (!manualInput.trim() || !selectedEventId) return
    try {
      const result = await validateTicket(manualInput.trim(), selectedEventId)
      setScanResult(result)
      setResultMessage(result.valid ? 'Ticket is valid and ready for check-in.' : result.message)
      setResultType(result.valid ? 'success' : 'warning')
      setResultDetail(result)
    } catch (err) {
      setResultMessage(err.response?.data?.message || 'Invalid ticket.')
      setResultType('error')
    }
  }

  function formatResult(result) {
    if (!result) return null
    const labels = {
      valid: 'Valid Ticket',
      already_used: 'Already Checked In',
      invalid: 'Invalid / Unknown',
      cancelled: 'Cancelled or Refunded',
      wrong_event: 'Wrong Event',
    }
    return labels[result.result] || result.result
  }

  function resultColor(type) {
    switch (type) {
      case 'success': return '#10b981'
      case 'error': return '#ef4444'
      case 'warning': return '#f59e0b'
      default: return '#4f46e5'
    }
  }

  if (loading) return <Loading text="Loading scanner..." />

  return (
    <div className="page-scanner">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">QR Ticket Scanner</h1>
          <p className="page-subtitle">Scan attendee tickets at the venue</p>
        </div>

        {cameraError && <ErrorMessage message={cameraError} onClose={() => setCameraError(null)} />}
        {resultMessage && (
          <div
            className={`scan-banner scan-banner--${resultType}`}
            role="status"
            aria-live="polite"
          >
            <span className="scan-banner-icon">
              {resultType === 'success' ? '✓' : resultType === 'warning' ? '⚠' : '✕'}
            </span>
            <span className="scan-banner-message">{resultMessage}</span>
          </div>
        )}

        <div className="scanner-card">
          <div className="scanner-header">
            <div className="event-select">
              <label className="form-label">Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="form-select"
                disabled={scanning}
              >
                <option value="">Select event to scan</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} — {new Date(event.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="camera-controls">
              {availableCameras.length > 1 && (
                <select
                  value={selectedCameraId || ''}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value || null)
                    stopCamera()
                    startCamera()
                  }}
                  className="form-select form-select--sm"
                >
                  <option value="">Default camera</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  if (cameraActive) stopCamera()
                  else startCamera()
                }}
                className={`btn ${cameraActive ? 'btn-outline' : 'btn-primary'} btn-sm`}
                disabled={!selectedEventId}
              >
                {cameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>
            </div>
          </div>

          <div className="scanner-viewfinder">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="scanner-video"
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            {!cameraActive && !cameraError && (
              <div className="scanner-placeholder">
                <span className="scanner-placeholder-icon">📷</span>
                <p>Click "Start Camera" to begin scanning</p>
                <p className="scanner-hint">
                  Requires HTTPS or localhost, and camera permission.
                </p>
              </div>
            )}
            <div className="scan-overlay">
              <div className="scan-frame"></div>
              <div className="scan-line"></div>
            </div>
          </div>

          {!cameraActive && !cameraError && (
            <div className="manual-entry">
              <h3>Manual Entry</h3>
              <form onSubmit={handleManualScan} className="manual-form">
                <div className="form-group">
                  <label className="form-label">Ticket Reference / QR Token</label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="form-input"
                    placeholder="Enter ticket reference..."
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={scanning} className="btn btn-primary">
                    {scanning ? 'Checking in...' : 'Check In'}
                  </button>
                  <button
                    type="button"
                    onClick={precheckTicket}
                    disabled={scanning || !manualInput.trim()}
                    className="btn btn-outline"
                  >
                    Pre-check Ticket
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {scanResult && (
          <div className="scan-result">
            <div className="scan-result-card">
              <h3>Scan Result</h3>
              <p><strong>Ticket:</strong> {scanResult.ticketNumber || 'N/A'}</p>
              <p><strong>Status:</strong> <span style={{ color: resultColor(resultType), fontWeight: 700 }}>{formatResult(scanResult)}</span></p>
              <p><strong>Message:</strong> {scanResult.message || '—'}</p>
            </div>
          </div>
        )}

        <div className="scan-history">
          <h3>Recent Scans</h3>
          {scanHistory.length === 0 ? (
            <p className="empty-history">No scans yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Ticket Reference</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.slice(0, 10).map((entry, i) => (
                  <tr key={i}>
                    <td>{new Date(entry.scannedAt).toLocaleTimeString()}</td>
                    <td className="ticket-ref">{entry.qrToken.slice(0, 12)}…</td>
                    <td>
                      <span className={`badge ${entry.result === 'valid' ? 'badge-success' : 'badge-danger'}`}>
                        {entry.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
