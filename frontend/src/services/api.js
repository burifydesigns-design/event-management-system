import axios from 'axios'

// Local dev falls back to the local API. A production build never guesses: without
// VITE_API_URL every API call fails with a message that says what to set.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '')

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    if (!API_URL) {
      const message = 'The API address is not set. Add VITE_API_URL to the frontend environment and redeploy.'
      const error = new Error(message)
      error.response = { status: 0, data: { message } }
      return Promise.reject(error)
    }
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }
    return Promise.reject(error)
  }
)

export default api
