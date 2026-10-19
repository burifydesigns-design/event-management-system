import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user)
        localStorage.setItem('user', JSON.stringify(data.user))
      })
      .catch((error) => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        if (error.response?.status !== 401) {
          setAuthError('Unable to verify your session. Please sign in again.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const { token, user } = data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    setAuthError(null)
    return user
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    const { token, user } = data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
    setAuthError(null)
    return user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setAuthError(null)
  }

  const updateProfile = async (profileData) => {
    const { data } = await api.put('/auth/profile', profileData)
    const updatedUser = { ...user, ...(data.user || data) }
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
    return updatedUser
  }

  const value = {
    user,
    token: localStorage.getItem('token'),
    login,
    register,
    logout,
    updateProfile,
    loading,
    authError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
