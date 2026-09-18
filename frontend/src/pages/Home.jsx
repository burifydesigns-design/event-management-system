import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EventCard from '../components/EventCard'
import { getEvents } from '../services/eventService'
import Loading from '../components/Loading'
import '../styles/home.css'

const CATEGORIES = [
  'Technology',
  'Business',
  'Music',
  'Sports',
  'Education',
  'Arts',
]

const FEATURES = [
  {
    title: 'Discover Events',
    description: 'Find events that match your interests and discover new experiences happening around you.',
    icon: '🔍',
  },
  {
    title: 'Easy Registration',
    description: 'Register for events quickly and keep track of the events you plan to attend.',
    icon: '✅',
  },
  {
    title: 'Digital Tickets',
    description: 'Keep your event tickets organized digitally and access them whenever you need them.',
    icon: '🎫',
  },
]

export default function Home() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getEvents({ limit: 6 })
        setEvents(data.events || [])
      } catch (err) {
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Discover Events Worth Experiencing
            </h1>
            <p className="hero-subtitle">
              Find exciting events, connect with amazing people, and create unforgettable experiences.
            </p>
            <div className="hero-search">
              <div className="hero-search-inner">
                <input
                  type="text"
                  placeholder="Search for events..."
                  className="hero-search-input"
                  readOnly
                />
                <Link to="/events" className="btn btn-primary hero-search-btn">
                  Search
                </Link>
              </div>
            </div>
            <div className="hero-actions">
              <Link to="/events" className="btn btn-primary btn-lg">
                Explore Events
              </Link>
              {user ? (
                <Link to="/create-event" className="btn btn-outline btn-lg">
                  Create an Event
                </Link>
              ) : (
                <Link to="/register" className="btn btn-outline btn-lg">
                  Create Account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Explore Popular Categories</h2>
          </div>
          <div className="categories-grid">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                to={`/events?category=${encodeURIComponent(category)}`}
                className="category-card"
              >
                <span className="category-name">{category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Upcoming Events</h2>
            <Link to="/events" className="section-link">
              View all →
            </Link>
          </div>
          {loading ? (
            <Loading text="Loading events..." />
          ) : events.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-icon">📭</p>
              <p className="empty-state-title">No events found</p>
              <p className="empty-state-text">
                Check back later for exciting events.
              </p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose Evently?</h2>
          </div>
          <div className="features-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-card">
                <span className="feature-icon">{feature.icon}</span>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cta">
        <div className="container">
          <div className="cta-card">
            <h2 className="cta-title">Ready to Host Your Own Event?</h2>
            <p className="cta-description">
              Create an event, reach your audience, and manage registrations from one place.
            </p>
            {user ? (
              <Link to="/create-event" className="btn btn-primary btn-lg">
                Create an Event
              </Link>
            ) : (
              <Link to="/register" className="btn btn-primary btn-lg">
                Create an Account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
