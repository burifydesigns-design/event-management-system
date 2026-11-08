import { useEffect, useMemo, useState } from 'react'
import { createOrder } from '../services/orderService'
import { getTicketTypesForEvent } from '../services/ticketService'

function fmtDate(iso) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function TicketSheet({ event, onClose }) {
  const eventId = event.id || event._id
  const [ticketTypes, setTicketTypes] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)

  useEffect(() => {
    let active = true
    getTicketTypesForEvent(eventId)
      .then((rows) => {
        if (!active) return
        setTicketTypes(Array.isArray(rows) ? rows : [])
        setSelectedTypeId(rows?.[0]?.id || '')
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Could not load ticket options.')
      })
      .finally(() => { if (active) setLoadingTypes(false) })
    return () => { active = false }
  }, [eventId])

  const selectedType = ticketTypes.find((item) => item.id === selectedTypeId)
  const available = selectedType ? Math.max(0, selectedType.quantity_available - selectedType.quantity_sold) : 0
  const total = useMemo(() => Number(selectedType?.price || 0) * quantity, [selectedType, quantity])

  const submitOrder = async () => {
    if (!selectedType || quantity < 1 || quantity > Math.min(10, available)) return
    setSubmitting(true)
    setError('')
    try {
      const result = await createOrder({ eventId, ticketTypeId: selectedType.id, quantity })
      setOrder(result)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the order.')
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => { onClose?.() }

  return (
    <div className="sheet open" aria-modal="true" role="dialog" aria-labelledby="ticket-sheet-title">
      <div className="sheet__overlay" onClick={close} />
      <div className="sheet__panel">
        <button type="button" className="sheet__close" onClick={close} aria-label="Close sheet">✕</button>
        <div className="sheet__content">
          <h2 id="ticket-sheet-title" style={{ fontSize: 'clamp(26px, 6vw, 34px)', marginBottom: 6 }}>{event.title}</h2>
          <p style={{ color: 'var(--mu)', fontSize: 13, marginBottom: 16 }}>{fmtDate(event.date || event.event_date)} · {event.location}</p>

          {order ? (
            <>
              <h3>Order created — payment pending</h3>
              <p style={{ color: 'var(--mu)', lineHeight: 1.6 }}>
                Your order has been recorded, but payment has not been connected or verified. No ticket has been issued and you are not yet registered as paid.
              </p>
              <p><strong>Order:</strong> {order.order?.id || 'Created'}</p>
              <p><strong>Amount:</strong> {order.payment?.currency || 'KES'} {Number(order.payment?.amount || total).toLocaleString()}</p>
              <p><strong>Status:</strong> {order.payment?.status || 'pending'}</p>
              <button type="button" className="btn btn--primary" onClick={close} style={{ marginTop: 16 }}>Close</button>
            </>
          ) : loadingTypes ? (
            <p>Loading ticket options…</p>
          ) : ticketTypes.length === 0 ? (
            <p style={{ color: 'var(--mu)' }}>Tickets are not available for this event yet. Please check again later.</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="ticket-type">Ticket type</label>
                <select id="ticket-type" className="input" value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)}>
                  {ticketTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — KES {Number(item.price).toLocaleString()} ({Math.max(0, item.quantity_available - item.quantity_sold)} available)
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="ticket-quantity">Quantity</label>
                <input id="ticket-quantity" className="input" type="number" min="1" max={Math.min(10, available)} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} disabled={!available} />
              </div>
              <p style={{ marginTop: 14 }}><strong>Total: KES {total.toLocaleString()}</strong></p>
              {error && <div className="alert alert--error" role="alert">{error}</div>}
              <button type="button" className="btn btn--primary" onClick={submitOrder}
                disabled={submitting || !selectedType || available < 1 || quantity > available} style={{ marginTop: 14 }}>
                {submitting ? 'Creating order…' : 'Create order'}
              </button>
              <p style={{ color: 'var(--mu)', fontSize: 12, marginTop: 12 }}>
                Payment is not enabled in this build. Creating an order does not charge you or issue a ticket.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
