import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchFilters from '../components/SearchFilters'
import EventCard from '../components/EventCard'
import Pagination from '../components/Pagination'
import { getEvents } from '../services/eventService'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import '../styles/events.css'

const DEFAULT_FILTERS = {
  search: '',
  category: '',
  city: '',
  date: '',
  price: '',
  page: 1,
  limit: 12,
  sort: 'date_asc'
}

const EVENTS_REQUEST_TIMEOUT_MS = 15000

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 })

  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    city: searchParams.get('city') || '',
    date: searchParams.get('date') || '',
    price: searchParams.get('price') || '',
    page: parseInt(searchParams.get('page'), 10) || 1,
    limit: parseInt(searchParams.get('limit'), 10) || 12,
    sort: searchParams.get('sort') || 'date_asc'
  }))

  const [categories, setCategories] = useState([])
  const [cities, setCities] = useState([])

  const fetchCategoriesAndCities = useCallback(async () => {
    try {
      const params = { limit: 1000 }
      const data = await getEvents(params)
      const allEvents = data.events || []
      const uniqueCategories = [...new Set(allEvents.map(e => e.category))].sort()
      const uniqueCities = [...new Set(allEvents.map(e => e.city))].sort()
      setCategories(uniqueCategories)
      setCities(uniqueCities)
    } catch (err) {
      console.error('Failed to load filter options:', err)
    }
  }, [])

  useEffect(() => {
    fetchCategoriesAndCities()
  }, [fetchCategoriesAndCities])

  const fetchEvents = useCallback(async () => {
    let controller = null
    let timeoutId = null
    try {
      setLoading(true)
      setError(null)
      controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), EVENTS_REQUEST_TIMEOUT_MS)
      const params = { ...filters }
      const data = await getEvents(params, { signal: controller.signal })
      setEvents(data.events || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to load events:', err)
      setError("Couldn't load events. Please try again.")
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      if (controller) controller.abort()
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleFilterChange = useCallback((newFilters) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }
    setFilters(updatedFilters)
    const params = new URLSearchParams()
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        params.set(key, value)
      }
    })
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const handlePageChange = useCallback((page) => {
    const updatedFilters = { ...filters, page }
    setFilters(updatedFilters)
    const params = new URLSearchParams()
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        params.set(key, value)
      }
    })
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const handleClearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

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
          <button type="button" onClick={fetchEvents} className="btn btn-primary">
            Retry
          </button>
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

        <SearchFilters
          onFilterChange={handleFilterChange}
          categories={categories}
          cities={cities}
          initialFilters={filters}
          onClear={handleClearFilters}
        />

        {events.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📭</p>
            <p className="empty-state-title">No events found</p>
            <p className="empty-state-text">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <>
            <div className="events-grid">
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
