import { useEffect, useState } from 'react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-10 h-10',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`rounded-full border-2 border-border-subtle border-t-accent-primary animate-spin ${sizeMap[size]} ${className}`}
      // Fuerza capa propia: el giro sigue fluido aunque el hilo principal esté ocupado.
      style={{ willChange: 'transform' }}
      role="status"
      aria-label="Cargando..."
    />
  )
}

interface PageLoaderProps {
  /** Espera antes de mostrarse; evita el parpadeo en cargas casi instantáneas. */
  delay?: number
  className?: string
}

export function PageLoader({ delay = 160, className = '' }: PageLoaderProps) {
  const [visible, setVisible] = useState(delay <= 0)

  useEffect(() => {
    if (delay <= 0) return
    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={`flex items-center justify-center min-h-[400px] ${className}`}
      aria-busy="true"
    >
      {visible && (
        <div className="flex flex-col items-center gap-4 animate-[fadeIn_180ms_ease-out]">
          <Spinner size="lg" />
          <p className="text-text-secondary text-sm">Cargando...</p>
        </div>
      )}
    </div>
  )
}
