import { useState, useMemo } from 'react'
import EventCard from '../components/EventCard'
import eventsData from '../data/events'
import '../styles/events.css'

export default function Events() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const categories = useMemo(() => {
    return [...new Set(eventsData.map((event) => event.category))].sort()
  }, [])

  const filteredEvents = useMemo(() => {
    return eventsData.filter((event) => {
      const term = search.toLowerCase().trim()
      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term) ||
        event.city.toLowerCase().includes(term)

      const matchesCategory = !category || event.category === category

      let matchesDate = true
      if (dateFilter === 'upcoming') {
        matchesDate = new Date(event.date) >= new Date(new Date().toDateString())
      } else if (dateFilter === 'past') {
        matchesDate = new Date(event.date) < new Date(new Date().toDateString())
      }

      return matchesSearch && matchesCategory && matchesDate
    })
  }, [search, category, dateFilter])

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

        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📭</p>
            <p className="empty-state-title">No events found</p>
            <p className="empty-state-text">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
