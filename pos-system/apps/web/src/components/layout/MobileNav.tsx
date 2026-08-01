import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  DollarSign,
  Menu,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useAuthStore } from '@/store/authStore'
import { rolesFor } from '@/lib/access'

interface MobileNavProps {
  onOpenMore: () => void
}

const mobileItems: { to: string; label: string; icon: React.ReactNode; roles: readonly string[] }[] = [
  { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={22} />, roles: rolesFor('dashboard') },
  { to: '/pos', label: 'Venta', icon: <ShoppingCart size={22} />, roles: rolesFor('pos') },
  // Atajo móvil solo para inventario; admin/supervisor lo abren desde Más
  { to: '/products', label: 'Productos', icon: <Package size={22} />, roles: ['inventario'] },
  { to: '/sales', label: 'Ventas', icon: <Receipt size={22} />, roles: rolesFor('sales') },
  { to: '/cash-register', label: 'Caja', icon: <DollarSign size={22} />, roles: rolesFor('cash-register') },
]

export function MobileNav({ onOpenMore }: MobileNavProps) {
  const reduce = useReducedMotion()
  const hasRole = useAuthStore((s) => s.hasRole)
  const visibleItems = mobileItems.filter((item) => hasRole([...item.roles]))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-bg-secondary border-t border-border-subtle safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 touch-target text-xs font-medium transition-colors',
                isActive ? 'text-accent-primary' : 'text-text-secondary',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  animate={reduce ? undefined : { y: isActive ? -2 : 0, scale: isActive ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                >
                  {item.icon}
                </motion.span>
                <span>{item.label}</span>
              </>
            )}
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
