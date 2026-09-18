import { useAuth } from '../context/AuthContext'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import Loading from './Loading'

function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/events" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
