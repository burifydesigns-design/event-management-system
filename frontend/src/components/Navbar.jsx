import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => setIsMenuOpen((prev) => !prev)

  const closeMenu = () => setIsMenuOpen(false)

  const getDashboardLink = () => {
    if (!user) return '/'
    if (user.role === 'admin') return '/dashboard/admin'
    if (user.role === 'organizer') return '/dashboard/organizer'
    return '/dashboard/attendee'
  }

  const navLinks = (
    <>
      <Link to="/" className="navbar-link" onClick={closeMenu}>
        Home
      </Link>
      <Link to="/events" className="navbar-link" onClick={closeMenu}>
        Events
      </Link>

      {user ? (
        <>
          <Link
            to={getDashboardLink()}
            className="navbar-link"
            onClick={closeMenu}
          >
            Dashboard
          </Link>
          {user.role === 'attendee' && (
            <>
              <Link
                to="/my-events"
                className="navbar-link"
                onClick={closeMenu}
              >
                My Events
              </Link>
              <Link
                to="/profile"
                className="navbar-link"
                onClick={closeMenu}
              >
                Profile
              </Link>
            </>
          )}
          {(user.role === 'organizer' || user.role === 'admin') && (
            <Link
              to="/create-event"
              className="navbar-link"
              onClick={closeMenu}
            >
              Create Event
            </Link>
          )}
          {user.role === 'admin' && (
            <>
              <Link
                to="/admin/users"
                className="navbar-link"
                onClick={closeMenu}
              >
                Users
              </Link>
              <Link
                to="/admin/analytics"
                className="navbar-link"
                onClick={closeMenu}
              >
                Analytics
              </Link>
            </>
          )}
          <div className="navbar-user">
            <span className="navbar-user-name">{user.name} ({user.role})</span>
            <button onClick={logout} className="navbar-logout">
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <Link
            to="/login"
            className="navbar-link"
            onClick={closeMenu}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="navbar-link navbar-link--primary"
            onClick={closeMenu}
          >
            Register
          </Link>
        </>
      )}
    </>
  )

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🎉</span>
          <span className="brand-text">EventEase</span>
        </Link>

        <button
          className="navbar-toggle"
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>

        <div
          id="mobile-menu"
          className={`navbar-menu ${isMenuOpen ? 'navbar-menu--open' : ''}`}
        >
          {navLinks}
        </div>
      </div>
    </nav>
  )
}
