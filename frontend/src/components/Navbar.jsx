import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const getDashboardLink = () => {
    if (!user) return '/'
    if (user.role === 'admin') return '/dashboard/admin'
    if (user.role === 'organizer') return '/dashboard/organizer'
    return '/dashboard/attendee'
  }

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          EventHub
        </Link>

        <button className="navbar-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </button>

        <div className={
avbar-menu }>
          <Link to="/" className="navbar-link">Home</Link>
          <Link to="/events" className="navbar-link">Events</Link>
          
          {user ? (
            <>
              <Link to={getDashboardLink()} className="navbar-link">Dashboard</Link>
              {user.role === 'attendee' && (
                <>
                  <Link to="/my-events" className="navbar-link">My Events</Link>
                  <Link to="/profile" className="navbar-link">Profile</Link>
                </>
              )}
              {(user.role === 'organizer' || user.role === 'admin') && (
                <Link to="/create-event" className="navbar-link">Create Event</Link>
              )}
              {user.role === 'admin' && (
                <>
                  <Link to="/admin/users" className="navbar-link">Users</Link>
                  <Link to="/admin/analytics" className="navbar-link">Analytics</Link>
                </>
              )}
              <div className="navbar-user">
                <span className="navbar-user-name">{user.name} ({user.role})</span>
                <button onClick={logout} className="navbar-logout">Logout</button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Login</Link>
              <Link to="/register" className="navbar-link navbar-link--primary">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
