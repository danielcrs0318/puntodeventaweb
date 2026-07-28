import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  DollarSign,
  Menu,
} from 'lucide-react'

interface MobileNavProps {
  onOpenMore: () => void
}

const mobileItems = [
  { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={22} /> },
  { to: '/pos', label: 'Venta', icon: <ShoppingCart size={22} /> },
  { to: '/sales', label: 'Ventas', icon: <Receipt size={22} /> },
  { to: '/cash-register', label: 'Caja', icon: <DollarSign size={22} /> },
]

export function MobileNav({ onOpenMore }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-bg-secondary border-t border-border-subtle safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 touch-target text-xs font-medium transition-colors',
                isActive ? 'text-accent-primary' : 'text-text-secondary',
              ].join(' ')
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 touch-target text-xs font-medium text-text-secondary"
          aria-label="Más opciones del menú"
        >
          <Menu size={22} />
          <span>Más</span>
        </button>
      </div>
    </nav>
  )
}
