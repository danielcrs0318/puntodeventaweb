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

/**
 * Abre un PDF en una pestaña nueva sin salir del POS.
 * Nota: `window.open(url, '_blank', 'noopener')` en Chrome devuelve null
 * aunque la pestaña se abra; nunca usar location.href como fallback.
 */
/** Descarga un archivo autenticado (PDF/CSV/etc.) vía API con token y sucursal. */
export async function downloadApiFile(
  path: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const response = await api.get(path, { responseType: 'blob' })
  const blob = new Blob([response.data], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000)
}

function openPdfInNewTab(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')

  if (!opened) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    toast.info('Comprobante listo', 'Si no se abre, permite ventanas emergentes para este sitio')
  }

  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

export async function openCashCloseReport(sessionId: number): Promise<void> {
  try {
    const response = await api.get(`/cash-register/sessions/${sessionId}/close-report`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    openPdfInNewTab(blob, `cierre-caja-${sessionId}.pdf`)
  } catch (error: unknown) {
    toast.error('No se pudo abrir el reporte', getApiErrorMessage(error, 'Intenta de nuevo'))
  }
}

export async function openSaleReceipt(saleId: number): Promise<void> {
  try {
    const response = await api.get(`/sales/${saleId}/receipt`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    openPdfInNewTab(blob, `recibo-${saleId}.pdf`)
  } catch (error: unknown) {
    toast.error('No se pudo abrir el recibo', getApiErrorMessage(error, 'Intenta de nuevo'))
  }
}
