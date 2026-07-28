import axios from 'axios'

export interface ApiErrorPayload {
  statusCode?: number
  message?: string | string[]
  requestId?: string
  path?: string
}

function messageFromPayload(data: ApiErrorPayload | undefined): string | null {
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string' && msg.trim()) return msg
  return null
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data instanceof Blob) {
      // Respuesta binaria (export PDF/CSV): el mensaje se resuelve con getApiErrorMessageAsync
      return fallback
    }
    const parsed = messageFromPayload(data as ApiErrorPayload | undefined)
    if (parsed) return parsed
    if (error.code === 'ECONNABORTED') return 'La solicitud tardó demasiado. Verifica tu conexión.'
    if (!error.response) return 'No se pudo conectar con el servidor.'
    return fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Igual que getApiErrorMessage, pero lee el cuerpo cuando Axios recibió un Blob de error. */
export async function getApiErrorMessageAsync(
  error: unknown,
  fallback = 'Ocurrió un error inesperado',
): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text()
      const json = JSON.parse(text) as ApiErrorPayload
      const parsed = messageFromPayload(json)
      if (parsed) return parsed
    } catch {
      /* ignore parse errors */
    }
  }
  return getApiErrorMessage(error, fallback)
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
