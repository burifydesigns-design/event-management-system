export default function ErrorMessage({ message = 'Something went wrong. Please try again.', onClose }) {
  return (
    <div className="alert alert--error">
      <span className="alert__icon">⚠</span>
      <span className="alert__message">{message}</span>
      {onClose && (
        <button onClick={onClose} className="alert__close" aria-label="Close">
          ×
        </button>
      )}
    </div>
  )
}
