import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventCard from '../components/EventCard'
import SearchFilters from '../components/SearchFilters'
import Pagination from '../components/Pagination'
import Loading from '../components/Loading'
import ErrorMessage from '../components/ErrorMessage'
import { getEvents } from '../services/eventService'

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [categories, setCategories] = useState([])
  const [cities, setCities] = useState([])

  const filters = {
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    city: searchParams.get('city') || '',
    date: searchParams.get('date') || '',
    price: searchParams.get('price') || '',
  }

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = {
          ...filters,
          page: currentPage,
          limit: 12,
        }

        const response = await getEvents(params)
        const data = response.data || response
        setEvents(data.events || data || [])
        setTotalPages(data.totalPages || 1)
        setTotalResults(data.total || data.length || 0)
        setCategories(data.categories || [])
        setCities(data.cities || [])
      } catch (err) {
        setError('Unable to load events. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [filters, currentPage])

  const handleFilterChange = (newFilters) => {
    setCurrentPage(1)
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    setSearchParams(params)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page-events">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">
            {totalResults > 0 ? `${totalResults} event${totalResults !== 1 ? 's' : ''} found` : 'Browse events'}
          </p>
        </div>

        <SearchFilters
          onFilterChange={handleFilterChange}
          categories={categories}
          cities={cities}
        />

        {loading ? (
          <Loading text="Loading events..." />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📭</p>
            <p className="empty-state-title">No events found</p>
            <p className="empty-state-text">Try adjusting your filters or search for something else.</p>
          </div>
        ) : (
          <>
            <div className="events-grid">
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
