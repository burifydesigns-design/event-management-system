import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const EventsIcon = () => (
  <svg className="tabs-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="3" />
    <path d="M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" />
  </svg>
)
const TicketIcon = () => (
  <svg className="tabs-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="1" ry="1" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <circle cx="7" cy="10" r="1" />
    <circle cx="17" cy="10" r="1" />
  </svg>
)
const ScanIcon = () => (
  <svg className="tabs-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="7" width="20" height="16" rx="2" ry="2" />
    <line x1="12" y1="15" x2="12.01" y2="15" />
    <path d="M7 10l5-5 5 5" />
  </svg>
)
const OrganizerIcon = () => (
  <svg className="tabs-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const ICONS = { discover: EventsIcon, ticket: TicketIcon, scan: ScanIcon, organizer: OrganizerIcon }

const TABS = [
  { key: 'discover', to: '/events', label: 'Events' },
  { key: 'ticket', to: '/my-events', label: 'Ticket' },
  { key: 'scan', to: '/scanner', label: 'Scan' },
  { key: 'organizer', to: '/dashboard/organizer', label: 'Organizer' },
]

const ROLE_TABS = {
  attendee: ['discover', 'ticket'],
  coordinator: ['scan'],
  organizer: ['discover', 'ticket', 'scan', 'organizer'],
  admin: ['discover', 'ticket', 'scan', 'organizer'],
}

export default function Shell({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  const role = user ? user.role : null
  const allowed = role ? ROLE_TABS[role] : ['discover']
  const tabs = TABS.filter((t) => allowed.includes(t.key))

  const activeKey = (() => {
    const byPath = { '/events': 'discover', '/my-events': 'ticket', '/scanner': 'scan', '/dashboard/organizer': 'organizer' }
    return byPath[location.pathname] || null
  })()

  const isCoordinator = role === 'coordinator'

  return (
    <div className="shell">
      <header className="shell__header">
        <Link to="/" className="shell__brand" aria-label="EventEase home">
          EventEase
        </Link>
        <div className="shell__actions">
          {user && (
            <button
              type="button"
              onClick={logout}
              className="btn btn--ghost"
              aria-label="Log out"
              title="Log out"
            >
              Log out
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
            title="Toggle theme"
            data-theme={theme}
          >
            {theme === 'dark' ? '◐' : '◑'}
          </button>
        </div>
      </header>

      <main className="shell__main">
        {children}
      </main>

      {!isCoordinator && (
        <nav className="tabs-bar" aria-label="Main navigation">
          <ul className="tabs-bar__list">
            {tabs.map((tab) => {
              const active = activeKey === tab.key
              const Comp = ICONS[tab.key]
              return (
                <li key={tab.key}>
                  <button
                    type="button"
                    className={`tabs-bar__tab ${active ? 'tabs-bar__tab--active' : ''}`}
                    aria-pressed={active}
                    aria-label={active ? `${tab.label}, active` : tab.label}
                    onClick={() => navigate(tab.to)}
                  >
                    <Comp />
                    <span className="tabs-bar__label">{tab.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
