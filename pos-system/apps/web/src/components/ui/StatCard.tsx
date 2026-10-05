import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, change, changeType = 'neutral', icon, className = '' }: StatCardProps) {
  const changeColor =
    changeType === 'positive' ? 'text-green-400' :
    changeType === 'negative' ? 'text-red-400' :
    'text-text-secondary'

  return (
    <div className={`card stat-card flex flex-col gap-4 min-h-[150px] ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        {icon && (
          <div className="w-11 h-11 rounded-2xl bg-accent-muted flex items-center justify-center text-accent-primary">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-text-primary leading-none tracking-tight">{value}</p>
      {change && (
        <p className={`text-xs ${changeColor}`}>{change}</p>
      )}
    </div>
  )
}
