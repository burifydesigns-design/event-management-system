import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Footer() {
  const { user } = useAuth()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <span className="brand-icon">🎉</span>
              <span className="brand-text">EventEase</span>
            </Link>
            <p className="footer-description">
              Discover, create, and experience amazing events.
            </p>
          </div>

          <div className="footer-links">
            <h4>Navigate</h4>
            <Link to="/">Home</Link>
            <Link to="/events">Events</Link>
          </div>

          <div className="footer-links">
            <h4>Account</h4>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            {user && (
              <>
                <Link to="/my-events">My Events</Link>
                <Link to="/profile">Profile</Link>
              </>
            )}
          </div>

          <div className="footer-links">
            <h4>Support</h4>
            <Link to="/events">Help Center</Link>
            <Link to="/events">Contact Us</Link>
            <Link to="/events">Privacy Policy</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 EventEase. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
