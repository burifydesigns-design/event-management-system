import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  message = 'Are you sure?',
  onConfirm,
  onCancel,
  visible,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
}) {
  const cancelButtonRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!visible) return undefined

    const previouslyFocused = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancelRef.current?.()
    }

    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="confirm-dialog-title" className="modal-title">Confirm Action</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button ref={cancelButtonRef} onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-danger" disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
