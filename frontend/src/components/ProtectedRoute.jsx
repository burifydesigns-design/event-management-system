import { useAuth } from '../context/AuthContext'
import { Navigate, useLocation, Outlet, Link } from 'react-router-dom'
import Loading from './Loading'

function ProtectedRoute({ allowedRoles }) {
  const { user, loading, authError } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />

  if (authError) {
    return (
      <div className="container" role="alert">
        <p>{authError}</p>
        <Link to="/login" className="btn btn-primary">Go to sign in</Link>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/events" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
