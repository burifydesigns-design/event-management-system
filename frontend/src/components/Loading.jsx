export default function Loading({ text = 'Loading...' }) {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <p className="loading-text">{text}</p>
    </div>
  )
}
