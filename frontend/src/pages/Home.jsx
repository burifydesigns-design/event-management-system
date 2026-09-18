import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import EventCard from '../components/EventCard'
import SearchFilters from '../components/SearchFilters'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getEvents } from '../services/eventService'

export default function Home() {
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categories] = useState([
    'Technology', 'Business', 'Music', 'Sports', 'Arts', 'Education', 'Health', 'Food'
  ])

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const [featured, upcoming] = await Promise.all([
          getEvents({ status: 'published', limit: 6, sort: 'createdAt' }),
          getEvents({ status: 'published', date: 'upcoming', limit: 4 }),
        ])
        setFeaturedEvents(featured.data || featured || [])
        setUpcomingEvents(upcoming.data || upcoming || [])
      } catch (err) {
        setError('Unable to load events. Please try again.')
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
              Discover Amazing <span className="text-primary">Events</span>
            </h1>
            <p className="hero-subtitle">
              Connect with people, learn new skills, and create unforgettable memories at events around you.
            </p>
            <div className="hero-search">
              <SearchFilters onFilterChange={(filters) => {
                const params = new URLSearchParams()
                if (filters.search) params.set('search', filters.search)
                window.location.href = `/events?${params.toString()}`
              }} categories={categories} />
            </div>
            <div className="hero-actions">
              <Link to="/events" className="btn btn-primary btn-lg">
                Explore Events
              </Link>
              <Link to="/register" className="btn btn-outline btn-lg">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Featured Events</h2>
            <Link to="/events" className="section-link">
              View all →
            </Link>
          </div>
          {loading ? (
            <Loading text="Loading featured events..." />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <div className="events-grid">
              {featuredEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
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
            <Loading text="Loading upcoming events..." />
          ) : (
            <div className="events-grid">
              {upcomingEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Browse by Category</h2>
          </div>
          <div className="categories-grid">
            {categories.map((category) => (
              <Link
                key={category}
                to={`/events?category=${encodeURIComponent(category)}`}
                className="category-card"
              >
                <span className="category-icon">📌</span>
                <span className="category-name">{category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
