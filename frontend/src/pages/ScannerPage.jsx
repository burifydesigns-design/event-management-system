import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkInTicket, getScannerEvents } from '../services/ticketService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'

function fmtTime(iso) {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ScannerPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [availableCameras, setAvailableCameras] = useState([])
  const [admitted, setAdmitted] = useState(0)
  const [loading, setLoading] = useState(true)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const resultTimerRef = useRef(null)

  const [result, setResult] = useState(null)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const data = await getScannerEvents()
      const list = data.data || []
      setEvents(list)
      if (list.length > 0 && !selectedEventId) {
        setSelectedEventId(list[0].id)
        setSelectedEvent(list[0])
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
    if (!selectedEventId) return
    try {
      setCameraError(null)
      const constraints = { video: { facingMode: 'environment' } }
      if (selectedCameraId) {
        constraints.video = { deviceId: { exact: selectedCameraId } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraActive(true)
      startScanningLoop()
    } catch (err) {
      let msg = 'Failed to access camera.'
      if (err.name === 'NotAllowedError') msg = 'Camera permission was denied.'
      else if (err.name === 'NotFoundError') msg = 'No camera found on this device.'
      else if (err.name === 'NotReadableError') msg = 'Camera is already in use by another application.'
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
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  function listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAvailableCameras(devices.filter((d) => d.kind === 'videoinput'))
    })
  }

  useEffect(() => {
    if (cameraActive) listCameras()
  }, [cameraActive])

  function startScanningLoop() {
    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(imageData)
          if (barcodes && barcodes.length > 0) {
            handleScannedValue(barcodes[0].rawValue)
          }
        }
      } catch (err) {
        // Ignore per-frame errors; keep scanning.
      }
    }, 1000)
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern)
    } catch { /* vibrate not supported */ }
  }

  function showResult(kind, title, sub) {
    stopCamera()
    setResult({ kind, title, sub })
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    resultTimerRef.current = setTimeout(() => {
      setResult(null)
      startCamera()
    }, 1800)
  }

  async function handleScannedValue(rawValue) {
    if (!selectedEventId) {
      showResult('wr', 'No event selected', 'Please select an event before scanning.')
      return
    }
    // Prevent rapid re-scans of the same code while a result is showing.
    if (result) return
    try {
      const res = await checkInTicket(rawValue, selectedEventId)
      if (res.valid) {
        setAdmitted((a) => a + 1)
        vibrate(40)
        showResult('ok', 'Valid', 'Admit 1 guest')
      } else if (res.result === 'already_used') {
        vibrate([80, 60, 80])
        showResult('bad', 'Already used', `Scanned at ${fmtTime(res.checkedInAt || new Date().toISOString())}`)
      } else if (res.result === 'wrong_event') {
        vibrate([80, 60, 80])
        const eventName = selectedEvent ? selectedEvent.title : 'a different event'
        showResult('wr', 'Wrong event', `This ticket is for ${eventName}.`)
      } else {
        vibrate([80, 60, 80])
        showResult('bad', 'Invalid', res.message || 'Ticket not found or invalid.')
      }
    } catch (err) {
      vibrate([80, 60, 80])
      const msg = err.response?.data?.message || 'Check-in failed.'
      showResult('bad', 'Invalid', msg)
    }
  }

  if (loading) return <Loading text="Loading scanner..." />

  return (
    <div className="page page--scanner scanner">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <h1>Scan tickets</h1>
          <div className="counter">{admitted}</div>
          <div className="counter__label">Admitted tonight</div>
        </div>

        {cameraError && <ErrorMessage message={cameraError} onClose={() => setCameraError(null)} />}

        <div className="viewfinder" role="region" aria-label="Camera viewfinder">
          <video ref={videoRef} autoPlay playsInline className="scanner-video" style={{ display: cameraActive ? 'block' : 'none' }} />
          {!cameraActive && !cameraError && (
            <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 24 }}>
              <p style={{ fontSize: 16, marginBottom: 6 }}>Tap Start Camera to begin scanning</p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>Requires HTTPS or localhost and camera permission.</p>
            </div>
          )}
          <div className="corner corner--tl" aria-hidden="true" />
          <div className="corner corner--tr" aria-hidden="true" />
          <div className="corner corner--bl" aria-hidden="true" />
          <div className="corner corner--br" aria-hidden="true" />
          <div className="scan-band" aria-hidden="true" />
        </div>

        <div className="form-row" style={{ marginBottom: 10 }}>
          <label className="visually-hidden">Event</label>
          <select
            className="input"
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value)
              setSelectedEvent(events.find((e) => String(e.id) === String(e.target.value)) || null)
            }}
            disabled={cameraActive}
          >
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {fmtDateOpt(event.date)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => { if (cameraActive) stopCamera(); else startCamera() }}
            disabled={!selectedEventId}
          >
            {cameraActive ? 'Stop camera' : 'Start camera'}
          </button>
        </div>

        {availableCameras.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label className="visually-hidden">Camera</label>
            <select className="input" value={selectedCameraId || ''} onChange={(e) => { setSelectedCameraId(e.target.value || null); stopCamera(); startCamera() }}>
              <option value="">Default camera</option>
              {availableCameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Full-screen scan result overlay */}
        {result && (
          <div className={`result-overlay ${result.kind === 'ok' ? '' : ''}`} onClick={() => {
            clearTimeout(resultTimerRef.current)
            setResult(null)
            setResultRaw(null)
            startCamera()
          }} role="alert" aria-live="assertive">
            <div className={`result__icon result__icon--${result.kind === 'ok' ? 'ok' : result.kind === 'bad' ? 'bad' : 'wr'}`} aria-hidden="true">
              {result.kind === 'ok' ? '✓' : '✕'}
            </div>
            <div className="result__text">{result.title}</div>
            <div className="result__sub">{result.sub}</div>
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--mu)' }}>Tap to resume scanning</p>
          </div>
        )}

        {!cameraActive && !cameraError && !result && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <p style={{ color: 'var(--mu)', fontSize: 13 }}>Scanning pauses automatically after each result.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtDateOpt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
