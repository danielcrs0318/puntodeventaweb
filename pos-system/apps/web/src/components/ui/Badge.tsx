import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  dot?: boolean
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  accent: 'badge-accent',
  neutral: 'badge-neutral',
  info: 'badge bg-blue-900/40 text-blue-300',
}

export function Badge({ variant = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {dot && (
        <span
          className={[
            'w-1.5 h-1.5 rounded-full',
            variant === 'success' ? 'bg-green-400' :
            variant === 'warning' ? 'bg-yellow-400' :
            variant === 'danger' ? 'bg-red-400' :
            variant === 'accent' ? 'bg-blue-400' :
            'bg-gray-400',
          ].join(' ')}
        />
      )}
      {children}
    </span>
  )
}
