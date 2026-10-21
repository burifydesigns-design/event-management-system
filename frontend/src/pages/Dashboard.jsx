import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login')
      return
    }
    if (user.role === 'admin') {
      navigate('/dashboard/admin')
    } else if (user.role === 'organizer') {
      navigate('/dashboard/organizer')
    } else {
      navigate('/dashboard/attendee')
    }
  }, [user, loading, navigate])

  if (loading) return <Loading text="Loading..." />
  return <Loading text="Redirecting..." />
}
