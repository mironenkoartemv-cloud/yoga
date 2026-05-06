import axios from 'axios'
import { API_BASE_URL } from '../config/backend'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Подставляем токен из sessionStorage в каждый запрос
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Если 401 — разлогиниваем
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = err.config?.url || ''
    const isAuthRequest = requestUrl.startsWith('/auth/')
    const hasToken = Boolean(sessionStorage.getItem('token'))

    if (err.response?.status === 401 && hasToken && !isAuthRequest) {
      sessionStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
