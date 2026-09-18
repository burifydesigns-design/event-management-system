import { useState, useEffect } from 'react'
import EventCard from '../components/EventCard'
import { getEvents } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import '../styles/events.css'

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const categories = [...new Set(events.map((event) => event.category))].sort()

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = {}
        if (search) params.search = search
        if (category) params.category = category
        if (dateFilter) params.date = dateFilter
        const data = await getEvents(params)
        setEvents(data.events || [])
      } catch (err) {
        setError('Failed to load events. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [search, category, dateFilter])

  if (loading) {
    return (
      <div className="page-events">
        <div className="container">
          <Loading text="Loading events..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-events">
        <div className="container">
          <ErrorMessage message={error} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-events">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Discover Events</h1>
          <p className="page-subtitle">
            Find and register for events happening around you.
          </p>
        </div>

        <div className="search-filters">
          <div className="search-filters-grid">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Events</option>
              <option value="upcoming">Upcoming Events</option>
              <option value="past">Past Events</option>
            </select>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📭</p>
            <p className="empty-state-title">No events found</p>
            <p className="empty-state-text">
              Try adjusting your search or filters.
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
    </div>
  )
}
