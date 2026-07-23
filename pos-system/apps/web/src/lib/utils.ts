import api from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage } from '@/lib/errors'

/**
 * Formatea un número como moneda en Lempiras (HNL)
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Number(amount ?? 0)
  return `L. ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * Formatea una fecha ISO a dd/mm/yyyy
 */
export function formatDate(isoString: string | Date | undefined | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Formatea fecha y hora
 */
export function formatDateTime(isoString: string | Date | undefined | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-HN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Calcula el cambio a devolver
 */
export function calculateChange(amountPaid: number, total: number): number {
  return Math.max(0, amountPaid - total)
}

/**
 * Días restantes hasta una fecha
 */
export function daysUntil(isoString: string | Date): number {
  const target = new Date(isoString)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Etiqueta amigable de estado de venta
 */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    COMPLETADA: 'Completada',
    PENDIENTE: 'Pendiente',
    ANULADA: 'Anulada',
    PARCIAL: 'Parcial',
  }
  return labels[status] ?? status
}

/**
 * Variante de badge según el estado
 */
export function statusClass(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    COMPLETADA: 'success',
    PENDIENTE: 'warning',
    ANULADA: 'danger',
  }
  return map[status] ?? 'neutral'
}

/**
 * Etiqueta de método de pago
 */
export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    TRANSFERENCIA: 'Transferencia',
    MIXTO: 'Mixto',
  }
  return labels[method] ?? method
}

/**
 * Trunca texto a longitud máxima
 */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}

/**
 * Genera un UUID v4 simple para IDs temporales
 */
export function generateTempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 11)}`
}

export async function openCashCloseReport(sessionId: number): Promise<void> {
  try {
    const response = await api.get(`/cash-register/sessions/${sessionId}/close-report`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
    if (!newWindow) window.location.href = url
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  } catch (error: unknown) {
    toast.error('No se pudo abrir el reporte', getApiErrorMessage(error, 'Intenta de nuevo'))
  }
}

export async function openSaleReceipt(saleId: number): Promise<void> {
  try {
    const response = await api.get(`/sales/${saleId}/receipt`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer')

    if (!newWindow) {
      window.location.href = url
    }

    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  } catch (error: unknown) {
    toast.error('No se pudo abrir el recibo', getApiErrorMessage(error, 'Intenta de nuevo'))
  }
}
