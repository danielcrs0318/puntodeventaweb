import { useState, useEffect, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
export type ToastPosition = 'top-left' | 'bottom-right'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
  position: ToastPosition
}

interface ToastOptions {
  duration?: number
  position?: ToastPosition
}

let listeners: ((toasts: ToastItem[]) => void)[] = []
let toasts: ToastItem[] = []

function notify(newToasts: ToastItem[]) {
  toasts = newToasts
  listeners.forEach((l) => l(toasts))
}

function parseOptions(
  durationOrOptions?: number | ToastOptions,
): Required<ToastOptions> {
  if (typeof durationOrOptions === 'number') {
    return { duration: durationOrOptions, position: 'bottom-right' }
  }
  return {
    duration: durationOrOptions?.duration ?? 4000,
    position: durationOrOptions?.position ?? 'bottom-right',
  }
}

function pushToast(
  type: ToastType,
  title: string,
  message?: string,
  durationOrOptions?: number | ToastOptions,
  defaultDuration = 4000,
) {
  const parsed = parseOptions(durationOrOptions)
  const duration = typeof durationOrOptions === 'number'
    ? durationOrOptions
    : (durationOrOptions?.duration ?? defaultDuration)
  const id = Math.random().toString(36).slice(2)
  notify([
    ...toasts,
    {
      id,
      type,
      title,
      message,
      duration,
      position: parsed.position,
    },
  ])
  setTimeout(() => {
    notify(toasts.filter((t) => t.id !== id))
  }, duration)
}

export const toast = {
  success: (title: string, message?: string, durationOrOptions?: number | ToastOptions) =>
    pushToast('success', title, message, durationOrOptions, 4000),
  error: (title: string, message?: string, durationOrOptions?: number | ToastOptions) =>
    pushToast('error', title, message, durationOrOptions, 6000),
  warning: (title: string, message?: string, durationOrOptions?: number | ToastOptions) =>
    pushToast('warning', title, message, durationOrOptions, 5000),
  info: (title: string, message?: string, durationOrOptions?: number | ToastOptions) =>
    pushToast('info', title, message, durationOrOptions, 4000),
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

const stackClass: Record<ToastPosition, string> = {
  'top-left':
    'fixed z-[100] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm top-20 left-4 md:left-[calc(16rem+1.25rem)] md:top-[5.25rem]',
  'bottom-right':
    'fixed z-[100] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm left-4 right-4 bottom-20 md:left-auto md:right-6 md:bottom-6 md:w-full',
}

function ToastStack({
  items,
  position,
  onRemove,
}: {
  items: ToastItem[]
  position: ToastPosition
  onRemove: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const fromLeft = position === 'top-left'
  const enterX = fromLeft ? -32 : 32
  const exitX = fromLeft ? -24 : 24

  if (!items.length) return null

  return (
    <div className={stackClass[position]} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            className={toastClasses[item.type]}
            initial={reduce ? false : { opacity: 0, x: enterX, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: exitX, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {icons[item.type]}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{item.title}</p>
              {item.message && (
                <p className="text-xs mt-0.5 opacity-80">{item.message}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
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

  const topLeft = items.filter((t) => t.position === 'top-left')
  const bottomRight = items.filter((t) => t.position !== 'top-left')

  return (
    <>
      <ToastStack items={topLeft} position="top-left" onRemove={remove} />
      <ToastStack items={bottomRight} position="bottom-right" onRemove={remove} />
    </>
  )
}
