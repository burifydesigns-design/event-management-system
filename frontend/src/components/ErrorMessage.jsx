export default function ErrorMessage({ message = 'Something went wrong. Please try again.', onClose, onRetry }) {
  return (
    <div className="alert alert-error">
      <span className="alert-icon">⚠️</span>
      <span className="alert-message">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline btn-sm">
          Retry
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="alert-close" aria-label="Close">
          ×
        </button>
      )}
    </div>
  )
}
