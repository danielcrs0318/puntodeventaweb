import { useState, useEffect, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

// Store de toasts en memoria (simple sin zustand para evitar dependencias circulares)
let listeners: ((toasts: ToastItem[]) => void)[] = []
let toasts: ToastItem[] = []

function notify(newToasts: ToastItem[]) {
  toasts = newToasts
  listeners.forEach((l) => l(toasts))
}

export const toast = {
  success: (title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    notify([...toasts, { id, type: 'success', title, message, duration }])
    setTimeout(() => {
      notify(toasts.filter((t) => t.id !== id))
    }, duration)
  },
  error: (title: string, message?: string, duration = 6000) => {
    const id = Math.random().toString(36).slice(2)
    notify([...toasts, { id, type: 'error', title, message, duration }])
    setTimeout(() => {
      notify(toasts.filter((t) => t.id !== id))
    }, duration)
  },
  warning: (title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).slice(2)
    notify([...toasts, { id, type: 'warning', title, message, duration }])
    setTimeout(() => {
      notify(toasts.filter((t) => t.id !== id))
    }, duration)
  },
  info: (title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    notify([...toasts, { id, type: 'info', title, message, duration }])
    setTimeout(() => {
      notify(toasts.filter((t) => t.id !== id))
    }, duration)
  },
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} className="text-green-400 flex-shrink-0" />,
  error: <XCircle size={18} className="text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />,
  info: <Info size={18} className="text-blue-400 flex-shrink-0" />,
}

const toastClasses: Record<ToastType, string> = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener = (t: ToastItem[]) => setItems([...t])
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const remove = (id: string) => {
    notify(toasts.filter((t) => t.id !== id))
  }

  if (items.length === 0) return null

  return (
    <div
      className="fixed z-[100] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm left-4 right-4 bottom-20 md:left-auto md:right-6 md:bottom-6 md:w-full"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`${toastClasses[item.type]} animate-slide-up`}
        >
          {icons[item.type]}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.title}</p>
            {item.message && (
              <p className="text-xs mt-0.5 opacity-80">{item.message}</p>
            )}
          </div>
          <button
            onClick={() => remove(item.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
