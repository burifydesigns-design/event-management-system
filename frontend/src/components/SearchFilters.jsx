import { useEffect, useState } from 'react'

export default function SearchFilters({ onFilterChange, categories = [], cities = [] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({
        search,
        category,
        city,
        date: dateFilter,
        price: priceFilter,
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [search, category, city, dateFilter, priceFilter, onFilterChange])

  const handleClear = () => {
    setSearch('')
    setCategory('')
    setCity('')
    setDateFilter('')
    setPriceFilter('')
  }

  return (
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
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="filter-select"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>

        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        <button onClick={handleClear} className="btn btn-outline">
          Clear Filters
        </button>
      </div>
    </div>
  )
}
