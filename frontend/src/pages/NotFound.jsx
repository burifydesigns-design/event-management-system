import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="container">
      <div className="empty-state">
        <p className="empty-state-icon">🔍</p>
        <p className="empty-state-title">Page Not Found</p>
        <p className="empty-state-text">
          The page you are looking for does not exist or has been removed.
        </p>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
