import axios from 'axios'

export interface ApiErrorPayload {
  statusCode?: number
  message?: string | string[]
  requestId?: string
  path?: string
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg.join(', ')
    if (typeof msg === 'string' && msg.trim()) return msg
    if (error.code === 'ECONNABORTED') return 'La solicitud tardó demasiado. Verifica tu conexión.'
    if (!error.response) return 'No se pudo conectar con el servidor.'
    return fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getApiRequestId(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorPayload | undefined)?.requestId
  }
  return undefined
}

export function logClientError(context: string, error: unknown): void {
  const message = getApiErrorMessage(error)
  const requestId = getApiRequestId(error)
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  console.error(`[POS:${context}]`, { message, status, requestId, error })
}
