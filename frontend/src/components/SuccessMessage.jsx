export default function SuccessMessage({ message = 'Success!', onClose }) {
  return (
    <div className="alert alert--success">
      <span className="alert__icon">✓</span>
      <span className="alert__message">{message}</span>
      {onClose && (
        <button onClick={onClose} className="alert__close" aria-label="Close">
          ×
        </button>
      )}
    </div>
  )
}
