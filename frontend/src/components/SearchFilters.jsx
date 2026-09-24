import { useState, useEffect, useRef } from 'react'

export default function SearchFilters({ onFilterChange, categories = [], cities = [], initialFilters = {}, onClear }) {
  const {
    search = '',
    category = '',
    city = '',
    date = '',
    price = '',
    sort = 'date_asc'
  } = initialFilters

  const [localSearch, setLocalSearch] = useState(search)
  const [localCategory, setLocalCategory] = useState(category)
  const [localCity, setLocalCity] = useState(city)
  const [localDate, setLocalDate] = useState(date)
  const [localPrice, setLocalPrice] = useState(price)
  const [localSort, setLocalSort] = useState(sort)
  const [dateMode, setDateMode] = useState(() => {
    if (!date) return 'preset'
    if (date === 'upcoming' || date === 'past') return 'preset'
    return 'specific'
  })

  const timeoutRef = useRef(null)

  const emitFilters = () => {
    const dateValue = dateMode === 'specific' ? localDate : (localDate || '')
    onFilterChange({
      search: localSearch,
      category: localCategory,
      city: localCity,
      date: dateValue,
      price: localPrice,
      sort: localSort
    })
  }

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(emitFilters, 300)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [localSearch, localCategory, localCity, localDate, localPrice, localSort, dateMode])

  useEffect(() => {
    setLocalSearch(search)
    setLocalCategory(category)
    setLocalCity(city)
    setLocalDate(date)
    setLocalPrice(price)
    setLocalSort(sort)
    if (date === 'upcoming' || date === 'past') {
      setDateMode('preset')
    } else if (date) {
      setDateMode('specific')
    } else {
      setDateMode('preset')
    }
  }, [search, category, city, date, price, sort])

  const handleClear = () => {
    setLocalSearch('')
    setLocalCategory('')
    setLocalCity('')
    setLocalDate('')
    setLocalPrice('')
    setLocalSort('date_asc')
    setDateMode('preset')
    if (onClear) onClear()
  }

  const sortOptions = [
    { value: 'date_asc', label: 'Date: Soonest First' },
    { value: 'date_desc', label: 'Date: Latest First' },
    { value: 'title_asc', label: 'Title: A-Z' },
    { value: 'title_desc', label: 'Title: Z-A' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' }
  ]

  return (
    <div className="search-filters">
      <div className="search-filters-grid">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search events..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={localCategory}
          onChange={(e) => setLocalCategory(e.target.value)}
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
          value={localCity}
          onChange={(e) => setLocalCity(e.target.value)}
          className="filter-select"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="date-filter-wrapper">
          <select
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value)}
            className="filter-select date-mode-select"
          >
            <option value="preset">All Dates</option>
            <option value="preset" disabled>── Presets ──</option>
            <option value="preset" data-preset="upcoming">Upcoming</option>
            <option value="preset" data-preset="past">Past</option>
            <option value="specific">Specific Date</option>
          </select>
          {dateMode === 'preset' && (
            <select
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
              className="filter-select date-preset-select"
            >
              <option value="">All Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          )}
          {dateMode === 'specific' && (
            <input
              type="date"
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
              className="filter-select date-picker"
            />
          )}
        </div>

        <select
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value)}
          className="filter-select"
        >
          <option value="">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        <select
          value={localSort}
          onChange={(e) => setLocalSort(e.target.value)}
          className="filter-select sort-select"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button onClick={handleClear} className="btn btn-outline">
          Clear Filters
        </button>
      </div>
    </div>
  )
}
