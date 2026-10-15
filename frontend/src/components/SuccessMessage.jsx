export default function SuccessMessage({ message = 'Success!', onClose }) {
  return (
    <div className="alert alert-success">
      <span className="alert-icon">✓</span>
      <span className="alert-message">{message}</span>
      {onClose && (
        <button onClick={onClose} className="alert-close" aria-label="Close">
          ×
        </button>
      )}
    </div>
  )
}
