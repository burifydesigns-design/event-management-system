import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/events')
  }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/events', label: 'Events' },
  ]

  if (user) {
    navLinks.push({ to: '/my-events', label: 'My Events' })
    navLinks.push({ to: '/profile', label: 'Profile' })
  }

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🎉</span>
          <span className="brand-text">EventEase</span>
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-menu ${isOpen ? 'navbar-menu--open' : ''}`}>
          <div className="navbar-nav">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="navbar-link"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="navbar-actions">
            {user ? (
              <div className="navbar-user">
                <Link to="/profile" className="navbar-user-link" onClick={() => setIsOpen(false)}>
                  <span className="user-avatar">{user.name?.charAt(0).toUpperCase()}</span>
                  <span className="user-name">{user.name}</span>
                </Link>
                <button onClick={handleLogout} className="btn btn-outline btn-sm">
                  Logout
                </button>
              </div>
            ) : (
              <div className="navbar-auth">
                <Link to="/login" className="btn btn-outline btn-sm" onClick={() => setIsOpen(false)}>
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setIsOpen(false)}>
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
