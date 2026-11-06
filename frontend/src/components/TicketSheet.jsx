import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder, confirmPayment } from '../services/orderService'
import { getMyTickets } from '../services/ticketService'

const TIERS = [
  { key: 'early', name: 'Early bird', multiplier: 0.7 },
  { key: 'regular', name: 'Regular', multiplier: 1 },
  { key: 'vip', name: 'VIP', multiplier: 2.5 },
]

function nearest50(n) {
  return Math.max(0, Math.round(Number(n) / 50) * 50)
}

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function TicketSheet({ event, onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [quantities, setQuantities] = useState({ early: 0, regular: 0, vip: 0 })
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticketId, setTicketId] = useState(null)

  const colorA = event.colorA || '#c42a55'
  const colorB = event.colorB || '#ffb703'
  const eventStyle = { '--a': colorA, '--b': colorB }

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)
  const total = TIERS.reduce((sum, t) => {
    const price = nearest50((event.price || 0) * t.multiplier)
    return sum + price * (quantities[t.key] || 0)
  }, 0)

  const adjust = useCallback((key, delta) => {
    setQuantities((prev) => {
      const next = { ...prev, [key]: Math.max(0, Math.min(10, (prev[key] || 0) + delta)) }
      return next
    })
  }, [])

  const handlePay = async (e) => {
    e.preventDefault()
    if (!phone.trim()) { setError('Please enter your phone number.'); return }
    if (totalQty === 0) { setError('Select at least one ticket.'); return }
    setError(null)
    setLoading(true)
    try {
      // Wire to existing purchase API: create order, then confirm payment (issues tickets).
      // Requires at least one ticket type to exist for the event (created via backend seed/admin).
      const orderRes = await createOrder({
        eventId: event._id || event.id,
        ticketTypeId: event._id || event.id,
        quantity: totalQty,
      })
      const order = orderRes.order || orderRes
      await confirmPayment({ orderId: order._id || order.id })
      const regs = await getMyTickets()
      const list = (regs.data || regs || []).filter((r) => String(r.event) === String(event._id || event.id))
      if (list.length) setTicketId(list[0].id)
      setStep(3)
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.message || 'Payment could not be processed. Ticket types may not be configured for this event.')
    } finally {
      if (step !== 3) setLoading(false)
    }
  }

  const handleViewTicket = () => {
    if (ticketId) navigate(`/my-ticket/${ticketId}`)
    else navigate('/my-events')
    onClose && onClose()
  }

  const closeSheet = () => { onClose && onClose(); setStep(1); setError(null) }

  const tierPrice = (t) => nearest50((event.price || 0) * t.multiplier)

  return (
    <div className={`sheet ${step === 1 ? 'open' : ''}`} aria-modal="true" role="dialog" aria-labelledby="sheet-title">
      <div className="sheet__overlay" onClick={closeSheet} />
      <div className="sheet__panel">
        <button type="button" className="sheet__close" onClick={closeSheet} aria-label="Close sheet">✕</button>
        <div className="sheet__content">
          {step === 1 && (
            <>
              <h2 id="sheet-title" style={{ fontSize: 'clamp(26px, 6vw, 34px)', marginBottom: 6 }}>{event.title}</h2>
              <div className="poster" style={eventStyle} minHeight="200px">
                <div className="poster__art" aria-hidden="true" />
                <div className="poster__body">
                  <span className="poster__kicker">Select your tickets</span>
                  <div className="poster__day" aria-label={fmtDate(event.date)}>{new Date(event.date).getDate()}</div>
                  <h3 className="poster__title">{event.title}</h3>
                  <p className="poster__meta">{fmtDate(event.date)} at {event.location}</p>
                </div>
              </div>
              <p style={{ color: '#625f82', fontSize: 13, marginBottom: 14 }}>Pick a tier and set the quantity for each.</p>
              {TIERS.map((t) => {
                const price = tierPrice(t)
                const qty = quantities[t.key] || 0
                const lineTotal = price * qty
                return (
                  <div key={t.key} className="tier">
                    <div className="tier__info">
                      <div className="tier__name">{t.name}</div>
                      <div className="tier__price">KES {price.toLocaleString()} each</div>
                    </div>
                    <div className="tier__meta">{qty > 0 ? `× ${qty} = KES ${lineTotal.toLocaleString()}` : ''}</div>
                    <div className="stepper">
                      <button type="button" className="stepper__btn" onClick={() => adjust(t.key, -1)} disabled={qty === 0} aria-label={`Decrease ${t.name}`}>−</button>
                      <span className="stepper__val">{qty}</span>
                      <button type="button" className="stepper__btn" onClick={() => adjust(t.key, 1)} disabled={qty === 10} aria-label={`Increase ${t.name}`}>+</button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: 'clamp(26px, 6vw, 34px)', marginBottom: 6 }}>Pay with M-Pesa</h2>
              <p style={{ color: '#625f82', fontSize: 13, marginBottom: 16 }}>Enter the phone number linked to your M-Pesa account.</p>
              <div className="field">
                <label>Phone number</label>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
              </div>
              {error && (
                <div style={{ background: 'rgba(214,40,57,0.1)', border: '1px solid rgba(214,40,57,0.2)', color: '#d62839', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14, marginTop: 8 }}>{error}</div>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={handlePay}
                disabled={loading || !phone.trim() || totalQty === 0}
              >
                {loading ? 'Processing…' : `Pay KES ${total.toLocaleString()}`}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <svg width="96" height="96" viewBox="0 0 24 24" aria-hidden="true" style={{ margin: '0 auto 16px' }}>
                <path d="M5 12l3 3 7-7" fill="none" stroke="#0f9d58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: '16', strokeDashoffset: '16', animation: 'drawCheck 0.7s cubic-bezier(.2,.8,.2,1) forwards' }} />
              </svg>
              <h2 style={{ fontSize: 28, marginBottom: 4 }}>You&rsquo;re in</h2>
              <p style={{ color: '#625f82', fontSize: 15, marginBottom: 20 }}>Your ticket is ready. You can view it anytime from the Ticket tab.</p>
              <div className="form-actions">
                <button type="button" className="btn btn--primary" onClick={handleViewTicket} disabled={loading}>View ticket</button>
                <button type="button" className="btn btn--ghost" onClick={closeSheet}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
