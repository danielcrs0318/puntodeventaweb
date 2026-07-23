import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const mobileItems = [
  { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={22} /> },
  { to: '/pos', label: 'Venta', icon: <ShoppingCart size={22} /> },
  { to: '/products', label: 'Productos', icon: <Package size={22} />, roles: ['admin', 'supervisor', 'inventario'] },
  { to: '/sales', label: 'Ventas', icon: <Receipt size={22} /> },
  { to: '/settings', label: 'Ajustes', icon: <Settings size={22} />, roles: ['admin'] },
]

export function MobileNav() {
  const { hasRole } = useAuthStore()
  const visible = mobileItems.filter((item) => !item.roles || hasRole(item.roles))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-bg-secondary border-t border-border-subtle safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {visible.map((item) => (
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
      </div>
    </nav>
  )
}
