export default function ErrorMessage({ message = 'Something went wrong. Please try again.', onClose }) {
  return (
    <div className="alert alert-error">
      <span className="alert-icon">⚠️</span>
      <span className="alert-message">{message}</span>
      {onClose && (
        <button onClick={onClose} className="alert-close" aria-label="Close">
          ×
        </button>
      )}
    </div>
  )
}
