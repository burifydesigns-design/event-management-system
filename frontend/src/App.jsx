import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetails from './pages/EventDetails'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateEvent from './pages/CreateEvent'
import EditEvent from './pages/EditEvent'
import MyEvents from './pages/MyEvents'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import Dashboard from './pages/Dashboard'
import AdminEvents from './pages/AdminEvents'
import AdminUsers from './pages/AdminUsers'
import AdminAttendees from './pages/AdminAttendees'
import AdminCheckIn from './pages/AdminCheckIn'
import AdminAnalytics from './pages/AdminAnalytics'
import DigitalTicket from './pages/DigitalTicket'

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/edit-event/:id" element={<EditEvent />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/my-ticket/:registrationId" element={<DigitalTicket />} />
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin/events" element={<AdminEvents />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/attendees" element={<AdminAttendees />} />
              <Route path="/admin/check-in" element={<AdminCheckIn />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
