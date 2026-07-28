import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage, logClientError } from '@/lib/errors'

/** En prod (Vercel): VITE_API_BASE_URL=https://tu-api.onrender.com — sin barra final ni /api */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

/** Origen del API para /uploads cuando el front y el back están en dominios distintos */
function apiOrigin(): string | null {
  if (!API_BASE || API_BASE === '/api' || API_BASE.startsWith('/')) return null
  try {
    return new URL(API_BASE).origin
  } catch {
    return null
  }
}

/** Convierte /uploads/... relativo a URL absoluta del API en producción */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url
  const origin = apiOrigin()
  if (!origin) return url
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Request interceptor: adjunta el token y la sucursal activa
api.interceptors.request.use((config) => {
  const { accessToken, activeBranch } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  if (activeBranch?.id) {
    config.headers['X-Branch-Id'] = String(activeBranch.id)
  }
  return config
})

// Response interceptor: refresca el token automáticamente si expira
let isRefreshing = false
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        const { accessToken, user, refreshToken: newRefresh, branches, activeBranch } = res.data
        useAuthStore.getState().setAuth(user, accessToken, newRefresh, branches, activeBranch)
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        processQueue(null, accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    logClientError(`API ${originalRequest?.method?.toUpperCase() ?? 'REQ'} ${originalRequest?.url ?? ''}`, error)
    return Promise.reject(error)
  },
)

export default api
export { API_BASE, resolveMediaUrl }
