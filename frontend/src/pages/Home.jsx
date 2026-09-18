import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EventCard from '../components/EventCard'
import '../styles/home.css'

const MOCK_EVENTS = [
  {
    _id: '1',
    title: 'React & JavaScript Workshop',
    category: 'Technology',
    date: '2026-07-15',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '10:00 AM',
    price: 25,
    capacity: 100,
    registeredCount: 72,
    image: 'https://via.placeholder.com/400x250/4f46e5/ffffff?text=React+Workshop',
    description: 'Hands-on workshop covering modern React patterns and JavaScript best practices.',
  },
  {
    _id: '2',
    title: 'Business Growth Summit',
    category: 'Business',
    date: '2026-07-22',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '9:00 AM',
    price: 50,
    capacity: 200,
    registeredCount: 134,
    image: 'https://via.placeholder.com/400x250/0ea5e9/ffffff?text=Business+Summit',
    description: 'Network with industry leaders and learn strategies to scale your business.',
  },
  {
    _id: '3',
    title: 'Live Music Festival',
    category: 'Music',
    date: '2026-08-02',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '4:00 PM',
    price: 35,
    capacity: 500,
    registeredCount: 320,
    image: 'https://via.placeholder.com/400x250/f59e0b/ffffff?text=Music+Festival',
    description: 'An unforgettable evening of live performances from top local and international artists.',
  },
  {
    _id: '4',
    title: 'Startup Pitch Night',
    category: 'Business',
    date: '2026-08-10',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '6:00 PM',
    price: 0,
    capacity: 150,
    registeredCount: 98,
    image: 'https://via.placeholder.com/400x250/10b981/ffffff?text=Startup+Pitch',
    description: 'Watch innovative startups pitch their ideas to a panel of investors.',
  },
  {
    _id: '5',
    title: 'Design Systems Conference',
    category: 'Technology',
    date: '2026-08-18',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '9:00 AM',
    price: 40,
    capacity: 250,
    registeredCount: 180,
    image: 'https://via.placeholder.com/400x250/8b5cf6/ffffff?text=Design+Systems',
    description: 'Deep dive into building scalable design systems for modern products.',
  },
  {
    _id: '6',
    title: 'Charity Run 5K',
    category: 'Sports',
    date: '2026-09-05',
    city: 'Nairobi',
    location: 'Nairobi, Kenya',
    time: '7:00 AM',
    price: 15,
    capacity: 1000,
    registeredCount: 650,
    image: 'https://via.placeholder.com/400x250/ef4444/ffffff?text=Charity+Run',
    description: 'Run for a cause. All proceeds go to local community development projects.',
  },
]

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
          <div className="events-grid">
            {MOCK_EVENTS.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
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
