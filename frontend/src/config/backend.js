const DEFAULT_BACKEND_URL = 'https://yoga-backend-ehje.onrender.com'

const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const backendUrl = import.meta.env.VITE_BACKEND_URL
  ? trimTrailingSlash(import.meta.env.VITE_BACKEND_URL)
  : import.meta.env.DEV
    ? ''
    : DEFAULT_BACKEND_URL

export const API_BASE_URL = backendUrl ? `${backendUrl}/api` : '/api'
export const SOCKET_URL = backendUrl || '/'
