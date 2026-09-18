import { Link } from 'react-router-dom'

export default function Footer() {
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
              Discover and manage amazing events. Connect with organizers and attendees worldwide.
            </p>
          </div>

          <div className="footer-links">
            <h4>Platform</h4>
            <Link to="/events">Browse Events</Link>
            <Link to="/events">Upcoming Events</Link>
            <Link to="/events">Past Events</Link>
          </div>

          <div className="footer-links">
            <h4>Account</h4>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            <Link to="/profile">My Profile</Link>
          </div>

          <div className="footer-links">
            <h4>Support</h4>
            <Link to="/events">Help Center</Link>
            <Link to="/events">Contact Us</Link>
            <Link to="/events">Privacy Policy</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} EventEase. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
